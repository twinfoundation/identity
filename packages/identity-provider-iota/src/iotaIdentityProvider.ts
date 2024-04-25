// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, GeneralError, Guards, Is, NotFoundError } from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import type {
	IDidDocument,
	IDidVerifiableCredential,
	IDidVerifiablePresentation,
	IDidDocumentVerificationMethod,
	IIdentityProvider
} from "@gtsc/identity-provider-models";
import { nameof } from "@gtsc/nameof";
import {
	Credential,
	Duration,
	EdCurve,
	EdDSAJwsVerifier,
	FailFast,
	IotaDID,
	IotaDocument,
	IotaIdentityClient,
	Jwk,
	JwkMemStore,
	JwkType,
	JwsAlgorithm,
	JwsSignatureOptions,
	JwtCredentialValidationOptions,
	JwtCredentialValidator,
	JwtPresentationOptions,
	JwtPresentationValidationOptions,
	JwtPresentationValidator,
	KeyIdMemStore,
	MethodScope,
	Presentation,
	Resolver,
	RevocationBitmap,
	Service,
	Storage,
	SubjectHolderRelationship,
	Timestamp,
	VerificationMethod,
	verifyEd25519,
	type IJwkParams,
	MethodDigest,
	Jwt
} from "@iota/identity-wasm/node";
import { Client, SecretManager, Utils, type PrivateKeySecretManager } from "@iota/sdk-wasm/node";
import {
	DEFAULT_IDENTITY_ACCOUNT_INDEX,
	type IIotaIdentityProviderConfig
} from "./models/IIotaIdentityProviderConfig";

/**
 * Class for performing identity operations on IOTA.
 */
export class IotaIdentityProvider implements IIdentityProvider {
	/**
	 * The namespace supported by the identity provider.
	 */
	public static NAMESPACE: string = "iota";

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IotaIdentityProvider>();

	/**
	 * The configuration to use for tangle operations.
	 * @internal
	 */
	private readonly _config: IIotaIdentityProviderConfig;

	/**
	 * The IOTA Identity client.
	 * @internal
	 */
	private _identityClient?: IotaIdentityClient;

	/**
	 * Create a new instance of IotaIdentityProvider.
	 * @param config The configuration to use.
	 */
	constructor(config: IIotaIdentityProviderConfig) {
		Guards.object<IIotaIdentityProviderConfig>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(config),
			config
		);
		Guards.object<IIotaIdentityProviderConfig>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		this._config = config;
		this._config.accountIndex = this._config.accountIndex ?? DEFAULT_IDENTITY_ACCOUNT_INDEX;
	}

	/**
	 * Create a new document from the key pair.
	 * @param documentPrivateKey The private key to use in generating the document.
	 * @param documentPublicKey The public key to use in generating the document.
	 * @returns The created document.
	 */
	public async createDocument(
		documentPrivateKey: Uint8Array,
		documentPublicKey: Uint8Array
	): Promise<IDidDocument> {
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPublicKey),
			documentPublicKey
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			const jwkParams: IJwkParams = {
				alg: JwsAlgorithm.EdDSA,
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64Url(documentPublicKey)
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const jwk = new Jwk({
				...jwkParams,
				kid: fingerPrint
			});

			const method = VerificationMethod.newFromJwk(document.id(), jwk, `#${fingerPrint}`);

			await document.insertMethod(method, MethodScope.AssertionMethod());

			// This is needed to support revocation.
			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			return await this.publish(document, documentPrivateKey, false);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"createDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}
			return document.toJSON() as IDidDocument;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"resolveDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param documentId The id of the document to add the verification method to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param verificationPublicKey The public key for the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationPublicKey: Uint8Array
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationPublicKey),
			verificationPublicKey
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const jwkParams: IJwkParams = {
				alg: JwsAlgorithm.EdDSA,
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64Url(verificationPublicKey)
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const jwk = new Jwk({
				...jwkParams,
				kid: fingerPrint
			});

			const method = VerificationMethod.newFromJwk(document.id(), jwk, `#${fingerPrint}`);

			const methods = document.methods();
			const existingMethod = methods.find(m => m.id().toString() === method.id().toString());

			if (existingMethod) {
				document.removeMethod(method.id());
			}

			document.insertMethod(method, MethodScope.VerificationMethod());

			return await this.publish(document, documentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param documentPrivateKey The key required to sign the updated document.
	 * @param verificationMethodId The id of the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationMethodId: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			document.removeMethod(method.id());

			return await this.publish(document, documentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const services = document.service();
			const existingService = services.find(s => s.id().toString() === serviceId);

			if (existingService) {
				document.removeService(existingService.id());
			}

			const service = new Service({
				id: serviceId,
				type: serviceType,
				serviceEndpoint
			});
			document.insertService(service);

			return await this.publish(document, documentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"addServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param documentId The id of the document to remove the service from.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const services = document.service();
			const service = services.find(s => s.id().toString() === serviceId);

			if (!service) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "serviceNotFound", serviceId);
			}

			document.removeService(service.id());

			return await this.publish(document, documentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"removeServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param assertionMethodId The assertion id to use.
	 * @param assertionMethodPrivateKey The private key required to generate the verifiable credential.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends { id?: string }>(
		issuerDocumentId: string,
		assertionMethodId: string,
		assertionMethodPrivateKey: Uint8Array,
		credentialId: string,
		schemaTypes: string | string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(assertionMethodId),
			assertionMethodId
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(assertionMethodPrivateKey),
			assertionMethodPrivateKey
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(credentialId), credentialId);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(IotaIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(IotaIdentityProvider._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(IotaIdentityProvider._CLASS_NAME, nameof(subject), subject);
		}
		Guards.number(IotaIdentityProvider._CLASS_NAME, nameof(revocationIndex), revocationIndex);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === assertionMethodId);

			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const unsignedVc = new Credential({
				id: credentialId,
				type: schemaTypes,
				issuer: issuerDocumentId,
				credentialSubject: subject,
				credentialStatus: {
					id: `${issuerDocument.id().toString()}#revocation`,
					type: RevocationBitmap.type(),
					revocationBitmapIndex: revocationIndex.toString()
				}
			});

			const jwkParams = {
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				kid: didMethod.publicKeyJwk.kid,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(assertionMethodPrivateKey)
			} as IJwkParams;

			const jwkMemStore = new JwkMemStore();
			const keyId = await jwkMemStore.insert(new Jwk(jwkParams));

			const keyIdMemStore = new KeyIdMemStore();
			const methodDigest = new MethodDigest(method);
			await keyIdMemStore.insertKeyId(methodDigest, keyId);

			const storage = new Storage(jwkMemStore, keyIdMemStore);
			const credentialJwt = await issuerDocument.createCredentialJwt(
				storage,
				`#${method.id().fragment()?.toString()}`,
				unsignedVc,
				new JwsSignatureOptions()
			);

			const validatedCredential = new JwtCredentialValidator(new EdDSAJwsVerifier());

			const decoded = validatedCredential.validate(
				credentialJwt,
				issuerDocument,
				new JwtCredentialValidationOptions(),
				FailFast.FirstError
			);

			return {
				verifiableCredential: decoded.credential().toJSON() as IDidVerifiableCredential<T>,
				jwt: credentialJwt.toString()
			};
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"createVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T>(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(credentialJwt), credentialJwt);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(credentialJwt);

			const issuerDocumentId = JwtCredentialValidator.extractIssuerFromJwt(jwt);
			const issuerDocument = await resolver.resolve(issuerDocumentId.toString());

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId.toString()
				);
			}

			const validatedCredential = new JwtCredentialValidator(new EdDSAJwsVerifier());

			const decoded = validatedCredential.validate(
				jwt,
				issuerDocument,
				new JwtCredentialValidationOptions(),
				FailFast.FirstError
			);

			const credential = decoded.credential();

			return {
				revoked: false,
				verifiableCredential: credential.toJSON() as IDidVerifiableCredential<T>
			};
		} catch (error) {
			if (error instanceof Error && error.message.toLowerCase().includes("revoked")) {
				return {
					revoked: true
				};
			}
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument> {
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentPrivateKey),
			issuerDocumentPrivateKey
		);
		Guards.arrayValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			issuerDocument.revokeCredentials("revocation", credentialIndices);

			return await this.publish(issuerDocument, issuerDocumentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to unrevoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument> {
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentPrivateKey),
			issuerDocumentPrivateKey
		);
		Guards.arrayValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			issuerDocument.unrevokeCredentials("revocation", credentialIndices);

			return await this.publish(issuerDocument, issuerDocumentPrivateKey, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param presentationPrivateKey The private key required to generate the verifiable presentation.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async createVerifiablePresentation(
		holderDocumentId: string,
		presentationMethodId: string,
		presentationPrivateKey: Uint8Array,
		schemaTypes: string | string[],
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(holderDocumentId),
			holderDocumentId
		);

		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationMethodId),
			presentationMethodId
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationPrivateKey),
			presentationPrivateKey
		);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(IotaIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		Guards.arrayValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);

		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(IotaIdentityProvider._CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(holderDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === presentationMethodId);
			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const unsignedVp = new Presentation({
				verifiableCredential: verifiableCredentials.map(j => new Jwt(j)),
				type: schemaTypes,
				holder: holderDocumentId
			});

			const jwkParams = {
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(presentationPrivateKey)
			} as IJwkParams;

			const jwkMemStore = new JwkMemStore();
			const keyId = await jwkMemStore.insert(new Jwk(jwkParams));

			const keyIdMemStore = new KeyIdMemStore();
			const methodDigest = new MethodDigest(method);
			await keyIdMemStore.insertKeyId(methodDigest, keyId);

			const expirationDate =
				Is.integer(expiresInMinutes) && expiresInMinutes > 0
					? Timestamp.nowUTC().checkedAdd(Duration.minutes(expiresInMinutes))
					: undefined;

			const storage = new Storage(jwkMemStore, keyIdMemStore);
			const presentationJwt = await issuerDocument.createPresentationJwt(
				storage,
				`#${method.id().fragment()?.toString()}`,
				unsignedVp,
				new JwsSignatureOptions(),
				new JwtPresentationOptions({ expirationDate })
			);

			const validatedCredential = new JwtPresentationValidator(new EdDSAJwsVerifier());

			const decoded = validatedCredential.validate(
				presentationJwt,
				issuerDocument,
				new JwtPresentationValidationOptions()
			);

			return {
				verifiablePresentation: decoded.presentation().toJSON() as IDidVerifiablePresentation,
				jwt: presentationJwt.toString()
			};
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"createVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async checkVerifiablePresentation(presentationJwt: string): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(presentationJwt), presentationJwt);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(presentationJwt);

			const holderId = JwtPresentationValidator.extractHolder(jwt);
			const holderDocument = await resolver.resolve(holderId.toString());

			if (Is.undefined(holderDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					holderId.toString()
				);
			}

			const validatedCredential = new JwtPresentationValidator(new EdDSAJwsVerifier());
			const decoded = validatedCredential.validate(
				jwt,
				holderDocument,
				new JwtPresentationValidationOptions()
			);

			const presentation = decoded.presentation();

			// Validate the credentials in the presentation.
			const credentialValidator = new JwtCredentialValidator(new EdDSAJwsVerifier());
			const validationOptions = new JwtCredentialValidationOptions({
				subjectHolderRelationship: [holderId.toString(), SubjectHolderRelationship.AlwaysSubject]
			});

			const jwtCredentials: Jwt[] = decoded
				.presentation()
				.verifiableCredential()
				.map(credential => {
					const j = credential.tryIntoJwt();
					if (j) {
						return j;
					}
				})
				.filter(Boolean) as Jwt[];

			// Concurrently resolve the issuers' documents.
			const issuers: string[] = [];
			for (const jwtCredential of jwtCredentials) {
				const issuer = JwtCredentialValidator.extractIssuerFromJwt(jwtCredential);
				issuers.push(issuer.toString());
			}
			const resolvedIssuers = await resolver.resolveMultiple(issuers);

			// Validate the credentials in the presentation.
			for (let i = 0; i < jwtCredentials.length; i++) {
				credentialValidator.validate(
					jwtCredentials[i],
					resolvedIssuers[i],
					validationOptions,
					FailFast.FirstError
				);
			}

			const jsonIssuers: unknown[] = [];
			for (let issuer of resolvedIssuers) {
				if (!("toJSON" in issuer)) {
					issuer = issuer.toCoreDocument();
				}
				jsonIssuers.push(issuer.toJSON());
			}

			return {
				revoked: false,
				verifiablePresentation: presentation.toJSON() as IDidVerifiablePresentation,
				issuers: jsonIssuers as IDidDocument[]
			};
		} catch (error) {
			if (error instanceof Error && error.message.toLowerCase().includes("revoked")) {
				return {
					revoked: true
				};
			}

			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param verificationPrivateKey The private key required to generate the proof.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		documentId: string,
		verificationMethodId: string,
		verificationPrivateKey: Uint8Array,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
	}> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.uint8Array(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationPrivateKey),
			verificationPrivateKey
		);
		Guards.uint8Array(IotaIdentityProvider._CLASS_NAME, nameof(bytes), bytes);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwkMemStore = new JwkMemStore();

			const jwk = new Jwk({
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(verificationPrivateKey)
			} as IJwkParams);

			const keyId = await jwkMemStore.insert(jwk);

			const signature = await jwkMemStore.sign(keyId, bytes, jwk);

			return {
				type: "Ed25519",
				value: signature
			};
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"createProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification id method to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @param bytes The data bytes to verify.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		documentId: string,
		verificationMethodId: string,
		signatureType: string,
		signatureValue: Uint8Array,
		bytes: Uint8Array
	): Promise<boolean> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(IotaIdentityProvider._CLASS_NAME, nameof(signatureValue), signatureValue);
		Guards.uint8Array(IotaIdentityProvider._CLASS_NAME, nameof(bytes), bytes);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const jwk = method.data().tryPublicKeyJwk();
			verifyEd25519(JwsAlgorithm.EdDSA, bytes, signatureValue, jwk);

			return true;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityProvider._CLASS_NAME,
				"verifyProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create the iota identity client.
	 * @returns The client.
	 * @internal
	 */
	private async getIotaIdentityClient(): Promise<IotaIdentityClient> {
		if (!this._identityClient) {
			const iotaClient = new Client(this._config.clientOptions);
			this._identityClient = new IotaIdentityClient(iotaClient);
		}

		return this._identityClient;
	}

	/**
	 * Sign and publish a document.
	 * @param document The document to sign and publish.
	 * @param documentPrivateKey The private key used to update the document.
	 * @param isUpdate True if this is an update.
	 * @returns The published document.
	 * @internal
	 */
	private async publish(
		document: IotaDocument,
		documentPrivateKey: Uint8Array,
		isUpdate: boolean
	): Promise<IDidDocument> {
		const identityClient = await this.getIotaIdentityClient();
		const networkHrp = await identityClient.getNetworkHrp();

		const privateSecretManager: PrivateKeySecretManager = {
			privateKey: Converter.bytesToHex(documentPrivateKey, true)
		};

		const secretManager = new SecretManager(privateSecretManager);
		const walletAddressesBech32 = await secretManager.generateEd25519Addresses({
			accountIndex: this._config.accountIndex,
			range: {
				start: 0,
				end: 1
			},
			bech32Hrp: networkHrp
		});

		document.setMetadataUpdated(Timestamp.nowUTC());
		const address = Utils.parseBech32Address(walletAddressesBech32[0]);

		const rentStructure = await identityClient.getRentStructure();

		let aliasOutput;
		if (isUpdate) {
			// If this is an update then get the current output and recalculate the
			// storage deposit from the updated document.
			aliasOutput = await identityClient.updateDidOutput(document);
			const updatedStorageDeposit = Utils.computeStorageDeposit(aliasOutput, rentStructure);

			// If this is an update then the alias output needs to be rebuilt with the new amount.
			aliasOutput = await identityClient.client.buildAliasOutput({
				...aliasOutput,
				amount: updatedStorageDeposit,
				aliasId: aliasOutput.getAliasId(),
				unlockConditions: aliasOutput.getUnlockConditions()
			});
		} else {
			// This is a new output so the amount for storage is calculated from the document.
			aliasOutput = await identityClient.newDidOutput(address, document, rentStructure);
		}

		const published = await identityClient.publishDidOutput(privateSecretManager, aliasOutput);

		return published.toJSON() as IDidDocument;
	}
}

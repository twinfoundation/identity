// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, GeneralError, Guards, Is, NotFoundError, NotSupportedError } from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import {
	KeyType,
	type IDidCredentialVerification,
	type IDidDocument,
	type IDidPresentationVerification,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation,
	type IIdentityProvider,
	type IKeyPair
} from "@gtsc/identity-provider-models";
import { nameof } from "@gtsc/nameof";
import {
	Credential,
	Duration,
	EdCurve,
	EdDSAJwsVerifier,
	FailFast,
	type IJwkParams,
	IotaDID,
	IotaDocument,
	IotaIdentityClient,
	Jwk,
	JwkMemStore,
	JwkType,
	JwsAlgorithm,
	JwsSignatureOptions,
	JwsVerificationOptions,
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
	verifyEd25519
} from "@iota/identity-wasm/node";
import { Client, SecretManager, Utils, type PrivateKeySecretManager } from "@iota/sdk-wasm/node";
import {
	DEFAULT_IDENTITY_ADDRESS_INDEX,
	type IIotaIdentityProviderConfig
} from "../models/IIotaIdentityProviderConfig";

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
		this._config.addressIndex = this._config.addressIndex ?? DEFAULT_IDENTITY_ADDRESS_INDEX;
	}

	/**
	 * Create a new document from the key pair.
	 * @param documentKeyPair The key pair to generate the document for.
	 * @returns The created document.
	 */
	public async createDocument(documentKeyPair: IKeyPair): Promise<IDidDocument> {
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
		);

		if (![KeyType.Ed25519].includes(documentKeyPair.type)) {
			throw new NotSupportedError(IotaIdentityProvider._CLASS_NAME, "unsupportedKeyType", {
				keyType: documentKeyPair.type
			});
		}

		try {
			const identityClient = await this.getIotaIdentityClient();
			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			const jwkParams: IJwkParams = {
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64(Converter.hexToBytes(documentKeyPair.publicKey))
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const jwk = new Jwk({
				...jwkParams,
				kid: fingerPrint
			});

			const method = VerificationMethod.newFromJwk(document.id(), jwk, fingerPrint);

			await document.insertMethod(method, MethodScope.VerificationMethod());

			// This is needed to support revocation.
			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			return await this.publish(document, documentKeyPair, false);
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
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param verificationPublicKey The public key for the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethodJwk(
		documentId: string,
		documentKeyPair: IKeyPair,
		verificationPublicKey: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
		);
		Guards.stringValue(
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
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64(Converter.hexToBytes(verificationPublicKey))
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const jwk = new Jwk({
				...jwkParams,
				kid: fingerPrint
			});

			const method = VerificationMethod.newFromJwk(document.id(), jwk, fingerPrint);

			const methods = document.methods();
			const existingMethod = methods.find(m => m.id().toString() === method.id().toString());

			if (existingMethod) {
				document.removeMethod(method.id());
			}

			document.insertMethod(method, MethodScope.VerificationMethod());

			return await this.publish(document, documentKeyPair, true);
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
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param verificationMethodName The name of the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		documentId: string,
		documentKeyPair: IKeyPair,
		verificationMethodName: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethodName),
			verificationMethodName
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methodUrl = document.id().toUrl().join(`#${verificationMethodName}`);
			const methods = document.methods();
			const methodExists = methods.find(m => m.id().toString() === methodUrl.toString());

			if (!methodExists) {
				return document.toJSON() as IDidDocument;
			}

			document.removeMethod(methodUrl);

			return await this.publish(document, documentKeyPair, true);
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
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		documentId: string,
		documentKeyPair: IKeyPair,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
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

			const service = new Service({
				id: document.id().toUrl().join(`#${serviceId}`),
				type: serviceType,
				serviceEndpoint
			});

			const services = document.service();
			const existingService = services.find(s => s.id().toString() === service.id().toString());

			if (existingService) {
				document.removeService(existingService.id());
			}

			document.insertService(service);

			return await this.publish(document, documentKeyPair, true);
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
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		documentId: string,
		documentKeyPair: IKeyPair,
		serviceId: string
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const serviceUrl = document.id().toUrl().join(`#${serviceId}`);
			const services = document.service();
			const existingService = services.find(s => s.id().toString() === serviceUrl.toString());

			if (!existingService) {
				return document.toJSON() as IDidDocument;
			}

			document.removeService(serviceUrl);

			return await this.publish(document, documentKeyPair, true);
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
	 * @param documentId The id of the document issuing the verifiable credential.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @param verificationMethod The verification method to use.
	 * @param verificationKeyPair The key required to generate the verifiable credential.
	 * @returns The created verifiable credential.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends { id?: string }>(
		documentId: string,
		credentialId: string,
		schemaTypes: string[],
		subject: T | T[],
		revocationIndex: string,
		verificationMethod: string,
		verificationKeyPair: IKeyPair
	): Promise<IDidVerifiableCredential<T>> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(credentialId), credentialId);
		Guards.arrayValue(IotaIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		if (Is.array(subject)) {
			Guards.arrayValue<T>(IotaIdentityProvider._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(IotaIdentityProvider._CLASS_NAME, nameof(subject), subject);
		}
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethod),
			verificationMethod
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.type),
			verificationKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.privateKey),
			verificationKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.publicKey),
			verificationKeyPair.publicKey
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const unsignedVc = new Credential({
				id: credentialId,
				type: schemaTypes,
				issuer: documentId,
				credentialSubject: subject,
				credentialStatus: {
					id: `${issuerDocument.id().toString()}#revocation`,
					type: RevocationBitmap.type(),
					revocationBitmapIndex: revocationIndex
				}
			});

			const jwkMemStore = new JwkMemStore();
			jwkMemStore.insert(
				new Jwk({
					kty: JwkType.Okp,
					crv: EdCurve.Ed25519,
					x: Converter.bytesToBase64(Converter.hexToBytes(verificationKeyPair.publicKey)),
					d: Converter.bytesToBase64(Converter.hexToBytes(verificationKeyPair.privateKey))
				})
			);

			const storage = new Storage(jwkMemStore, new KeyIdMemStore());
			const credentialJwt = await issuerDocument.createCredentialJwt(
				storage,
				`#${verificationMethod}`,
				unsignedVc,
				new JwsSignatureOptions()
			);

			return credentialJwt.toJSON() as IDidVerifiableCredential<T>;
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
	 * @param credential The credential to verify.
	 * @returns Verification details for the credential.
	 */
	public async checkVerifiableCredential<T>(
		credential: IDidVerifiableCredential<T>
	): Promise<IDidCredentialVerification> {
		Guards.object<IDidVerifiableCredential<T>>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(credential),
			credential
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const credentialJwt = Credential.fromJSON(credential);

			const validatedCredential = new JwtCredentialValidator(new EdDSAJwsVerifier());

			const issuerId = JwtCredentialValidator.extractIssuer(credentialJwt);
			let issuerDocument = await resolver.resolve(issuerId.toString());

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerId.toString()
				);
			}

			if ("toCoreDocument" in issuerDocument) {
				issuerDocument = issuerDocument.toCoreDocument();
			}

			validatedCredential.validate(
				credentialJwt,
				issuerDocument,
				new JwtCredentialValidationOptions(),
				FailFast.FirstError
			);

			const subResolutions = [];

			for (const sub of credentialJwt.credentialSubject()) {
				if (Is.stringValue(sub.id)) {
					subResolutions.push(resolver.resolve(sub.id));
				}
			}
			const subjects = await Promise.all(subResolutions);

			return {
				isVerified: true,
				issuer: {
					id: issuerDocument.id().toString(),
					isVerified: true,
					document: issuerDocument.toJSON() as IDidDocument
				},
				subjects: subjects.map(s => {
					if ("toCoreDocument" in s) {
						s = s.toCoreDocument();
					}
					return {
						id: s.id().toString(),
						isVerified: true,
						document: s.toJSON() as IDidDocument
					};
				})
			};
		} catch (error) {
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
	 * @param documentId The id of the document to update the revocation list for.
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		documentId: string,
		documentKeyPair: IKeyPair,
		credentialIndices: number[]
	): Promise<IDidDocument> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.object<IKeyPair>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair),
			documentKeyPair
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.type),
			documentKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.privateKey),
			documentKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(documentKeyPair.publicKey),
			documentKeyPair.publicKey
		);
		Guards.arrayValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			document.revokeCredentials("revocation", credentialIndices);

			return await this.publish(document, documentKeyPair, true);
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
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param documentId The id of the document creating the verifiable presentation.
	 * @param verifiableCredentials The credentials to use for creating the presentation.
	 * @param presentationMethod The method to associate with the presentation.
	 * @param presentationKeyPair The key required to generate the verifiable presentation.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The verifiable presentation.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async createVerifiablePresentation(
		documentId: string,
		verifiableCredentials: IDidVerifiableCredential<unknown> | IDidVerifiableCredential<unknown>[],
		presentationMethod: string,
		presentationKeyPair: IKeyPair,
		expiresInMinutes: number = -1
	): Promise<IDidVerifiablePresentation> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		if (Is.array(verifiableCredentials)) {
			Guards.arrayValue(
				IotaIdentityProvider._CLASS_NAME,
				nameof(verifiableCredentials),
				verifiableCredentials
			);
		} else {
			Guards.object(
				IotaIdentityProvider._CLASS_NAME,
				nameof(verifiableCredentials),
				verifiableCredentials
			);
		}

		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationMethod),
			presentationMethod
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationKeyPair.type),
			presentationKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationKeyPair.privateKey),
			presentationKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentationKeyPair.publicKey),
			presentationKeyPair.publicKey
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const vcs = (
				Is.array(verifiableCredentials) ? verifiableCredentials : [verifiableCredentials]
			).map(vc => Credential.fromJSON(vc));

			const unsignedVp = new Presentation({
				id: documentId,
				verifiableCredential: vcs,
				holder: document.id()
			});

			const jwkMemStore = new JwkMemStore();
			jwkMemStore.insert(
				new Jwk({
					kty: JwkType.Okp,
					crv: EdCurve.Ed25519,
					x: Converter.bytesToBase64(Converter.hexToBytes(presentationKeyPair.publicKey)),
					d: Converter.bytesToBase64(Converter.hexToBytes(presentationKeyPair.privateKey))
				})
			);

			const storage = new Storage(jwkMemStore, new KeyIdMemStore());

			const expirationDate =
				expiresInMinutes > 0
					? Timestamp.nowUTC().checkedAdd(Duration.minutes(expiresInMinutes))
					: undefined;

			const presentationJwt = await document.createPresentationJwt(
				storage,
				presentationMethod,
				unsignedVp,
				new JwsSignatureOptions(),
				new JwtPresentationOptions({ expirationDate })
			);

			return presentationJwt.toJSON() as IDidVerifiablePresentation;
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
	 * Verify a presentation.
	 * @param presentation The presentation to verify.
	 * @returns Verification details for the presentation.
	 */
	public async checkVerifiablePresentation(
		presentation: IDidVerifiablePresentation
	): Promise<IDidPresentationVerification> {
		Guards.object<IDidVerifiablePresentation>(
			IotaIdentityProvider._CLASS_NAME,
			nameof(presentation),
			presentation
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const presentationJwt = Presentation.fromJSON(presentation);

			const presentationHolderDid = JwtPresentationValidator.extractHolder(presentationJwt);
			let resolvedHolder = await resolver.resolve(presentationHolderDid.toString());

			if ("toCoreDocument" in resolvedHolder) {
				resolvedHolder = resolvedHolder.toCoreDocument();
			}

			const jwtPresentationValidationOptions = new JwtPresentationValidationOptions({
				presentationVerifierOptions: new JwsVerificationOptions()
			});

			// Validate presentation. Note that this doesn't validate the included credentials.
			const presentationValidator = new JwtPresentationValidator(new EdDSAJwsVerifier());
			const decodedPresentation = presentationValidator.validate(
				presentationJwt,
				resolvedHolder,
				jwtPresentationValidationOptions
			);

			// Validate the credentials in the presentation.
			const credentialValidator = new JwtCredentialValidator(new EdDSAJwsVerifier());
			const validationOptions = new JwtCredentialValidationOptions({
				subjectHolderRelationship: [
					presentationHolderDid.toString(),
					SubjectHolderRelationship.AlwaysSubject
				]
			});

			const jwtCredentials = decodedPresentation
				.presentation()
				.verifiableCredential()
				.map(credential => {
					const jwt = credential.tryIntoJwt();
					if (jwt) {
						return jwt;
					}
					throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "expectingJwtCredential");
				});

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

			return {
				isVerified: true,
				holder: {
					id: resolvedHolder.id().toString(),
					isVerified: true,
					document: resolvedHolder.toJSON() as IDidDocument
				}
			};
		} catch (error) {
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
	 * @param bytes The data bytes to sign.
	 * @param verificationMethod The verification method to use.
	 * @param verificationKeyPair The key required to generate the proof.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		documentId: string,
		bytes: Uint8Array,
		verificationMethod: string,
		verificationKeyPair: IKeyPair
	): Promise<{
		type: string;
		value: string;
	}> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(IotaIdentityProvider._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethod),
			verificationMethod
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.type),
			verificationKeyPair.type
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.privateKey),
			verificationKeyPair.privateKey
		);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationKeyPair.publicKey),
			verificationKeyPair.publicKey
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === `#${verificationMethod}`);

			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const jwkMemStore = new JwkMemStore();

			const jwk = new Jwk({
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64(Converter.hexToBytes(verificationKeyPair.publicKey)),
				d: Converter.bytesToBase64(Converter.hexToBytes(verificationKeyPair.privateKey))
			});

			const keyId = await jwkMemStore.insert(jwk);

			const signature = await jwkMemStore.sign(keyId, bytes, jwk);

			return {
				type: "Ed25519",
				value: Converter.bytesToHex(signature)
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
	 * @param bytes The data bytes to verify.
	 * @param verificationMethod The verification method to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		documentId: string,
		bytes: Uint8Array,
		verificationMethod: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean> {
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(IotaIdentityProvider._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(
			IotaIdentityProvider._CLASS_NAME,
			nameof(verificationMethod),
			verificationMethod
		);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.stringValue(IotaIdentityProvider._CLASS_NAME, nameof(signatureValue), signatureValue);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === `#${verificationMethod}`);

			if (!method) {
				throw new GeneralError(IotaIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const jwk = method.data().tryPublicKeyJwk();
			verifyEd25519(JwsAlgorithm.EdDSA, bytes, Converter.hexToBytes(signatureValue), jwk);

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
	 * @param documentKeyPair The key pair to generate the document for.
	 * @param isUpdate True if this is an update.
	 * @returns The published document.
	 * @internal
	 */
	private async publish(
		document: IotaDocument,
		documentKeyPair: IKeyPair,
		isUpdate: boolean
	): Promise<IDidDocument> {
		const identityClient = await this.getIotaIdentityClient();
		const networkHrp = await identityClient.getNetworkHrp();

		const privateSecretManager: PrivateKeySecretManager = {
			privateKey: documentKeyPair.privateKey
		};

		const secretManager = new SecretManager(privateSecretManager);
		const walletAddressesBech32 = await secretManager.generateEd25519Addresses({
			accountIndex: this._config.addressIndex,
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

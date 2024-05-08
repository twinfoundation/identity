// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, GeneralError, Guards, Is, NotFoundError, RandomHelper } from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import type { IIdentityConnector } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IRequestContext } from "@gtsc/services";
import type {
	DidVerificationMethodType,
	IDidDocument,
	IDidDocumentVerificationMethod,
	IDidService,
	IDidVerifiableCredential,
	IDidVerifiablePresentation
} from "@gtsc/standards-w3c-did";
import type { IVaultConnector } from "@gtsc/vault-models";
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
	Jwt,
	JwtCredentialValidationOptions,
	JwtCredentialValidator,
	JwtPresentationOptions,
	JwtPresentationValidationOptions,
	JwtPresentationValidator,
	KeyIdMemStore,
	MethodDigest,
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
	type IJwkParams
} from "@iota/identity-wasm/node";
import { Client, SecretManager, Utils, type PrivateKeySecretManager } from "@iota/sdk-wasm/node";
import {
	DEFAULT_IDENTITY_ACCOUNT_INDEX,
	type IIotaIdentityConnectorConfig
} from "./models/IIotaIdentityConnectorConfig";

/**
 * Class for performing identity operations on IOTA.
 */
export class IotaIdentityConnector implements IIdentityConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static NAMESPACE: string = "iota";

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IotaIdentityConnector>();

	/**
	 * The configuration to use for tangle operations.
	 * @internal
	 */
	private readonly _config: IIotaIdentityConnectorConfig;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The IOTA Identity client.
	 * @internal
	 */
	private _identityClient?: IotaIdentityClient;

	/**
	 * Create a new instance of IotaIdentityConnector.
	 * @param dependencies The dependencies for the identity connector.
	 * @param dependencies.vaultConnector The vault for the private keys.
	 * @param config The configuration to use.
	 */
	constructor(
		dependencies: {
			vaultConnector: IVaultConnector;
		},
		config: IIotaIdentityConnectorConfig
	) {
		Guards.object<IotaIdentityConnector>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(dependencies),
			dependencies
		);
		Guards.object<IotaIdentityConnector>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(dependencies.vaultConnector),
			dependencies.vaultConnector
		);
		this._vaultConnector = dependencies.vaultConnector;

		Guards.object<IIotaIdentityConnectorConfig>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(config),
			config
		);
		Guards.object<IIotaIdentityConnectorConfig>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(config.clientOptions),
			config.clientOptions
		);

		this._config = config;
		this._config.accountIndex = this._config.accountIndex ?? DEFAULT_IDENTITY_ACCOUNT_INDEX;
	}

	/**
	 * Create a new document.
	 * @param requestContext The context for the request.
	 * @param privateKey The private key to use for the document in base64, if undefined a new key will be generated.
	 * @param publicKey The public key to use for the document in base64, must be provided if privateKey is supplied.
	 * @returns The created document.
	 */
	public async createDocument(
		requestContext: IRequestContext,
		privateKey?: string,
		publicKey?: string
	): Promise<IDidDocument> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		const hasPrivateKey = Is.stringValue(privateKey);
		if (hasPrivateKey) {
			Guards.stringBase64(IotaIdentityConnector._CLASS_NAME, nameof(privateKey), privateKey);
		}
		const hasPublicKey = Is.stringValue(publicKey);
		if (hasPublicKey) {
			Guards.stringBase64(IotaIdentityConnector._CLASS_NAME, nameof(publicKey), publicKey);
		}
		if (hasPrivateKey !== hasPublicKey) {
			throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "privateAndPublic");
		}

		try {
			const identityClient = await this.getIotaIdentityClient();
			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			if (hasPrivateKey && hasPublicKey) {
				await this._vaultConnector.addKey(
					requestContext,
					document.id().toString(),
					"Ed25519",
					privateKey,
					publicKey
				);
			} else {
				await this._vaultConnector.createKey(requestContext, document.id().toString(), "Ed25519");
			}

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			return await this.updateDocument(requestContext, document, false);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"createDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(
		requestContext: IRequestContext,
		documentId: string
	): Promise<IDidDocument> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}
			return document.toJSON() as IDidDocument;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"resolveDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.arrayOneOf(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			[
				"verificationMethod",
				"authentication",
				"assertionMethod",
				"keyAgreement",
				"capabilityInvocation",
				"capabilityDelegation"
			]
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const tempKeyId = `temp-${Converter.bytesToBase64Url(RandomHelper.generate(32))}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				requestContext,
				tempKeyId,
				"Ed25519"
			);

			const jwkParams: IJwkParams = {
				alg: JwsAlgorithm.EdDSA,
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64Url(Converter.base64ToBytes(verificationPublicKey))
			};

			const kid = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const jwk = new Jwk({
				...jwkParams,
				kid
			});

			const methodId = `#${verificationMethodId ?? kid}`;

			await this._vaultConnector.renameKey(
				requestContext,
				tempKeyId,
				`${document.id().toString()}${methodId}`
			);

			const method = VerificationMethod.newFromJwk(document.id(), jwk, methodId);

			const methods = document.methods();
			const existingMethod = methods.find(m => m.id().toString() === method.id().toString());

			if (existingMethod) {
				document.removeMethod(method.id());
			}

			if (verificationMethodType === "verificationMethod") {
				document.insertMethod(method, MethodScope.VerificationMethod());
			} else if (verificationMethodType === "authentication") {
				document.insertMethod(method, MethodScope.Authentication());
			} else if (verificationMethodType === "assertionMethod") {
				document.insertMethod(method, MethodScope.AssertionMethod());
			} else if (verificationMethodType === "keyAgreement") {
				document.insertMethod(method, MethodScope.KeyAgreement());
			} else if (verificationMethodType === "capabilityDelegation") {
				document.insertMethod(method, MethodScope.CapabilityDelegation());
			} else if (verificationMethodType === "capabilityInvocation") {
				document.insertMethod(method, MethodScope.CapabilityDelegation());
			}

			await this.updateDocument(requestContext, document, true);

			return method.toJSON() as IDidDocumentVerificationMethod;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			document.removeMethod(method.id());

			await this.updateDocument(requestContext, document, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
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

			await this.updateDocument(requestContext, document, true);

			return service.toJSON() as IDidService;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"addServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the service from.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const services = document.service();
			const service = services.find(s => s.id().toString() === serviceId);

			if (!service) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "serviceNotFound", serviceId);
			}

			document.removeService(service.id());

			await this.updateDocument(requestContext, document, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"removeServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		verificationMethodId: string,
		credentialId: string,
		schemaTypes: string | string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(credentialId), credentialId);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(IotaIdentityConnector._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(IotaIdentityConnector._CLASS_NAME, nameof(subject), subject);
		}
		Guards.number(IotaIdentityConnector._CLASS_NAME, nameof(revocationIndex), revocationIndex);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
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

			const verificationMethodKey = await this._vaultConnector.getKey(
				requestContext,
				verificationMethodId
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwkParams = {
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				kid: didMethod.publicKeyJwk.kid,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(
					Converter.base64ToBytes(verificationMethodKey.privateKey).slice(0, 32)
				)
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
				IotaIdentityConnector._CLASS_NAME,
				"createVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param requestContext The context for the request.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		credentialJwt: string
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(credentialJwt), credentialJwt);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(credentialJwt);

			const issuerDocumentId = JwtCredentialValidator.extractIssuerFromJwt(jwt);
			const issuerDocument = await resolver.resolve(issuerDocumentId.toString());

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
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
				IotaIdentityConnector._CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.arrayValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			issuerDocument.revokeCredentials("revocation", credentialIndices);

			await this.updateDocument(requestContext, issuerDocument, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.arrayValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			issuerDocument.unrevokeCredentials("revocation", credentialIndices);

			await this.updateDocument(requestContext, issuerDocument, true);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param requestContext The context for the request.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		requestContext: IRequestContext,
		holderDocumentId: string,
		presentationMethodId: string,
		schemaTypes: string | string[],
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(holderDocumentId),
			holderDocumentId
		);

		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(presentationMethodId),
			presentationMethodId
		);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		Guards.arrayValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);

		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(IotaIdentityConnector._CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}
		try {
			const identityClient = await this.getIotaIdentityClient();
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(holderDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === presentationMethodId);
			if (!method) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const unsignedVp = new Presentation({
				verifiableCredential: verifiableCredentials.map(j => new Jwt(j)),
				type: schemaTypes,
				holder: holderDocumentId
			});

			const verificationMethodKey = await this._vaultConnector.getKey(
				requestContext,
				presentationMethodId
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwkParams = {
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(
					Converter.base64ToBytes(verificationMethodKey.privateKey).slice(0, 32)
				)
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
				IotaIdentityConnector._CLASS_NAME,
				"createVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable presentation is valid.
	 * @param requestContext The context for the request.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async checkVerifiablePresentation(
		requestContext: IRequestContext,
		presentationJwt: string
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(presentationJwt), presentationJwt);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(presentationJwt);

			const holderId = JwtPresentationValidator.extractHolder(jwt);
			const holderDocument = await resolver.resolve(holderId.toString());

			if (Is.undefined(holderDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
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
				IotaIdentityConnector._CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign in base64.
	 * @returns The proof signature type and value in base64.
	 */
	public async createProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: string
	): Promise<{
		type: string;
		value: string;
	}> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		Guards.string(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwkMemStore = new JwkMemStore();

			const verificationMethodKey = await this._vaultConnector.getKey(
				requestContext,
				verificationMethodId
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwk = new Jwk({
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(
					Converter.base64ToBytes(verificationMethodKey.privateKey).slice(0, 32)
				)
			} as IJwkParams);

			const keyId = await jwkMemStore.insert(jwk);

			const signature = await jwkMemStore.sign(keyId, Converter.base64ToBytes(bytes), jwk);

			return {
				type: "Ed25519",
				value: Converter.bytesToBase64(signature)
			};
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"createProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify in base64.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof in base64.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean> {
		Guards.object<IRequestContext>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.string(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.string(IotaIdentityConnector._CLASS_NAME, nameof(signatureValue), signatureValue);

		try {
			const identityClient = await this.getIotaIdentityClient();
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(IotaIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const jwk = method.data().tryPublicKeyJwk();
			verifyEd25519(
				JwsAlgorithm.EdDSA,
				Converter.base64ToBytes(bytes),
				Converter.base64ToBytes(signatureValue),
				jwk
			);

			return true;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
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
	 * @param requestContext The context for the request.
	 * @param document The document to sign and publish.
	 * @param isUpdate True if this is an update.
	 * @returns The published document.
	 * @internal
	 */
	private async updateDocument(
		requestContext: IRequestContext,
		document: IotaDocument,
		isUpdate: boolean
	): Promise<IDidDocument> {
		const identityClient = await this.getIotaIdentityClient();
		const networkHrp = await identityClient.getNetworkHrp();

		const key = await this._vaultConnector.getKey(requestContext, document.id().toString());

		const privateSecretManager: PrivateKeySecretManager = {
			privateKey: Converter.bytesToHex(Converter.base64ToBytes(key.privateKey), true)
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

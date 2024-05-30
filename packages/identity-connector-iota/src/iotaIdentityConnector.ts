// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, GeneralError, Guards, Is, NotFoundError, RandomHelper } from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import type { IIdentityConnector } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IRequestContext } from "@gtsc/services";
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@gtsc/standards-w3c-did";
import { VaultKeyType, type IVaultConnector } from "@gtsc/vault-models";
import type { IWalletConnector } from "@gtsc/wallet-models";
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
import { type Block, Client, CoinType, type IBuildBlockOptions, Utils } from "@iota/sdk-wasm/node";
import type { IIotaIdentityConnectorConfig } from "./models/IIotaIdentityConnectorConfig";

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
	 * Default name for the mnemonic secret.
	 * @internal
	 */
	private static readonly _DEFAULT_MNEMONIC_SECRET_NAME: string = "wallet-mnemonic";

	/**
	 * The default index to use for storing identities.
	 * @internal
	 */
	private static readonly _DEFAULT_ADDRESS_INDEX = 1;

	/**
	 * Default coin type.
	 * @internal
	 */
	private static readonly _DEFAULT_COIN_TYPE: number = CoinType.IOTA;

	/**
	 * The default length of time to wait for the inclusion of a transaction in seconds.
	 * @internal
	 */
	private static readonly _DEFAULT_INCLUSION_TIMEOUT: number = 60;

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
	 * Connector for wallet operations.
	 * @internal
	 */
	private readonly _walletConnector: IWalletConnector;

	/**
	 * The IOTA Identity client.
	 * @internal
	 */
	private _identityClient?: IotaIdentityClient;

	/**
	 * Create a new instance of IotaIdentityConnector.
	 * @param dependencies The dependencies for the identity connector.
	 * @param dependencies.vaultConnector The vault for the private keys.
	 * @param dependencies.walletConnector The wallet connector.
	 * @param config The configuration to use.
	 */
	constructor(
		dependencies: {
			vaultConnector: IVaultConnector;
			walletConnector: IWalletConnector;
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
		Guards.object<IWalletConnector>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(dependencies.walletConnector),
			dependencies.walletConnector
		);

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

		this._vaultConnector = dependencies.vaultConnector;
		this._walletConnector = dependencies.walletConnector;
		this._config = config;
		this._config.walletMnemonicId ??= IotaIdentityConnector._DEFAULT_MNEMONIC_SECRET_NAME;
		this._config.addressIndex ??= IotaIdentityConnector._DEFAULT_ADDRESS_INDEX;
		this._config.coinType ??= IotaIdentityConnector._DEFAULT_COIN_TYPE;
		this._config.inclusionTimeoutSeconds ??= IotaIdentityConnector._DEFAULT_INCLUSION_TIMEOUT;
	}

	/**
	 * Create a new document.
	 * @param requestContext The context for the request.
	 * @returns The created document.
	 */
	public async createDocument(requestContext: IRequestContext): Promise<IDidDocument> {
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

		try {
			const identityClient = await this.getIotaIdentityClient();
			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			const newDocument = await this.updateDocument(requestContext, document, true);

			return newDocument;
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
		Guards.arrayOneOf<DidVerificationMethodType>(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
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
				VaultKeyType.Ed25519
			);

			const jwkParams: IJwkParams = {
				alg: JwsAlgorithm.EdDSA,
				kty: JwkType.Okp,
				crv: EdCurve.Ed25519,
				x: Converter.bytesToBase64Url(verificationPublicKey)
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
				document.insertMethod(method, MethodScope.CapabilityInvocation());
			}

			await this.updateDocument(requestContext, document, false);

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

			await this.updateDocument(requestContext, document, false);
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

			await this.updateDocument(requestContext, document, false);

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

			await this.updateDocument(requestContext, document, false);
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
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
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

			await this.updateDocument(requestContext, issuerDocument, false);
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

			await this.updateDocument(requestContext, issuerDocument, false);
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
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
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
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
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

		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);

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
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
			} as IJwkParams);

			const keyId = await jwkMemStore.insert(jwk);

			const signature = await jwkMemStore.sign(keyId, bytes, jwk);

			return {
				type: "Ed25519",
				value: signature
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
	 * @param bytes The data bytes to verify.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: Uint8Array,
		signatureType: string,
		signatureValue: Uint8Array
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
		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(signatureValue), signatureValue);

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
			verifyEd25519(JwsAlgorithm.EdDSA, bytes, signatureValue, jwk);

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
	 * @param isNewDocument Is this a new document.
	 * @returns The published document.
	 * @internal
	 */
	private async updateDocument(
		requestContext: IRequestContext,
		document: IotaDocument,
		isNewDocument: boolean
	): Promise<IDidDocument> {
		const identityClient = await this.getIotaIdentityClient();

		const identityAddressIndex =
			this._config.addressIndex ?? IotaIdentityConnector._DEFAULT_ADDRESS_INDEX;

		const addresses = await this._walletConnector.getAddresses(
			requestContext,
			identityAddressIndex,
			1
		);

		const identityAddress = addresses[0];

		document.setMetadataUpdated(Timestamp.nowUTC());
		const address = Utils.parseBech32Address(identityAddress);

		const rentStructure = await identityClient.getRentStructure();

		let aliasOutput;
		if (isNewDocument) {
			// This is a new output so the amount for storage is calculated from the document.
			aliasOutput = await identityClient.newDidOutput(address, document, rentStructure);
		} else {
			// If this is an update then get the current output and recalculate the
			// storage deposit from the updated document.
			aliasOutput = await identityClient.updateDidOutput(document);
			const updatedStorageDeposit = Utils.computeStorageDeposit(aliasOutput, rentStructure);

			// If this is an update then the alias output needs to be rebuilt with the new amount.
			aliasOutput = await identityClient.client.buildAliasOutput({
				...aliasOutput,
				amount: updatedStorageDeposit
			});
		}

		const mnemonic = await this._vaultConnector.getSecret<string>(
			requestContext,
			this._config.walletMnemonicId ?? IotaIdentityConnector._DEFAULT_MNEMONIC_SECRET_NAME
		);

		const blockDetails = await this.prepareAndPostTransaction(identityClient.client, mnemonic, {
			outputs: [aliasOutput]
		});

		const networkHrp = await identityClient.getNetworkHrp();
		const published = await IotaDocument.unpackFromBlock(networkHrp, blockDetails.block);

		return published[0].toJSON() as IDidDocument;
	}

	/**
	 * Prepare a transaction for sending, post and wait for inclusion.
	 * @param client The client to use.
	 * @param mnemonic The mnemonic to use.
	 * @param options The options for the transaction.
	 * @returns The block id and block.
	 * @internal
	 */
	private async prepareAndPostTransaction(
		client: Client,
		mnemonic: string,
		options: IBuildBlockOptions
	): Promise<{ blockId: string; block: Block }> {
		const prepared = await client.prepareTransaction(
			{ mnemonic },
			{
				coinType: this._config.coinType ?? IotaIdentityConnector._DEFAULT_COIN_TYPE,
				...options
			}
		);

		const signed = await client.signTransaction({ mnemonic }, prepared);

		const blockIdAndBlock = await client.postBlockPayload(signed);

		try {
			const timeoutSeconds =
				this._config.inclusionTimeoutSeconds ?? IotaIdentityConnector._DEFAULT_INCLUSION_TIMEOUT;

			await client.retryUntilIncluded(blockIdAndBlock[0], 2, Math.ceil(timeoutSeconds / 2));
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"inclusionFailed",
				undefined,
				error
			);
		}

		return {
			blockId: blockIdAndBlock[0],
			block: blockIdAndBlock[1]
		};
	}
}

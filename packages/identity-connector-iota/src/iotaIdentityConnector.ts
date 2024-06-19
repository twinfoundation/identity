// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BaseError,
	Converter,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	RandomHelper,
	type IError
} from "@gtsc/core";
import { Bip39, Sha256 } from "@gtsc/crypto";
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
	type IJwkParams,
	type Subject
} from "@iota/identity-wasm/node/index.js";
import {
	Client,
	CoinType,
	Utils,
	type Block,
	type IBuildBlockOptions
} from "@iota/sdk-wasm/node/lib/index.js";
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
	 * Default name for the seed secret.
	 */
	private static readonly _DEFAULT_SEED_SECRET_NAME: string = "seed";

	/**
	 * Default name for the mnemonic secret.
	 * @internal
	 */
	private static readonly _DEFAULT_MNEMONIC_SECRET_NAME: string = "mnemonic";

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
		this._config = config;
		this._config.vaultMnemonicId ??= IotaIdentityConnector._DEFAULT_MNEMONIC_SECRET_NAME;
		this._config.vaultSeedId ??= IotaIdentityConnector._DEFAULT_SEED_SECRET_NAME;
		this._config.coinType ??= IotaIdentityConnector._DEFAULT_COIN_TYPE;
		this._config.inclusionTimeoutSeconds ??= IotaIdentityConnector._DEFAULT_INCLUSION_TIMEOUT;
	}

	/**
	 * Create a new document.
	 * @param requestContext The context for the request.
	 * @param controller The controller for the document.
	 * @returns The created document.
	 */
	public async createDocument(
		requestContext: IRequestContext,
		controller: string
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
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(controller), controller);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			const newDocument = await this.updateDocument(requestContext, document, true, controller);

			return newDocument;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"createDocumentFailed",
				undefined,
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

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
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const controller = document.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					documentId
				);
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

			await this.updateDocument(requestContext, document, false, controller);

			return method.toJSON() as IDidDocumentVerificationMethod;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param requestContext The context for the request.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		requestContext: IRequestContext,
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
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"missingDid",
					verificationMethodId
				);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const controller = document.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					documentId
				);
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

			await this.updateDocument(requestContext, document, false, controller);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const controller = document.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					documentId
				);
			}

			const fullServiceId = serviceId.includes("#") ? serviceId : `${documentId}#${serviceId}`;

			const services = document.service();
			const existingService = services.find(s => s.id().toString() === fullServiceId);

			if (existingService) {
				document.removeService(existingService.id());
			}

			const service = new Service({
				id: fullServiceId,
				type: serviceType,
				serviceEndpoint
			});
			document.insertService(service);

			await this.updateDocument(requestContext, document, false, controller);

			return service.toJSON() as IDidService;
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"addServiceFailed",
				undefined,
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param requestContext The context for the request.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(requestContext: IRequestContext, serviceId: string): Promise<void> {
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
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const hashIndex = serviceId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "missingDid", serviceId);
			}

			const documentId = serviceId.slice(0, hashIndex);
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "documentNotFound", documentId);
			}

			const controller = document.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					documentId
				);
			}

			const services = document.service();
			const service = services.find(s => s.id().toString() === serviceId);

			if (!service) {
				throw new NotFoundError(IotaIdentityConnector._CLASS_NAME, "serviceNotFound", serviceId);
			}

			document.removeService(service.id());

			await this.updateDocument(requestContext, document, false, controller);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"removeServiceFailed",
				undefined,
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param requestContext The context for the request.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param types The type for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param contexts Additional contexts to include in the credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T>(
		requestContext: IRequestContext,
		verificationMethodId: string,
		credentialId: string | undefined,
		types: string | string[] | undefined,
		subject: T | T[],
		contexts?: string | string[],
		revocationIndex?: number
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
			nameof(verificationMethodId),
			verificationMethodId
		);
		if (!Is.undefined(credentialId)) {
			Guards.stringValue(
				IotaIdentityConnector._CLASS_NAME,
				nameof(credentialId),
				credentialId
			);
		}
		if (Is.array(types)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(types), types);
		} else if (Is.stringValue(types)) {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(types), types);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(IotaIdentityConnector._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(IotaIdentityConnector._CLASS_NAME, nameof(subject), subject);
		}
		if (Is.array(contexts)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(contexts), contexts);
		} else if (Is.stringValue(types)) {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(contexts), contexts);
		}
		if (!Is.undefined(revocationIndex)) {
			Guards.number(IotaIdentityConnector._CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"missingDid",
					verificationMethodId
				);
			}

			const issuerDocumentId = verificationMethodId.slice(0, hashIndex);
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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

			const finalTypes = [];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const finalContexts = [];
			if (Is.array(contexts)) {
				finalContexts.push(...contexts);
			} else if (Is.stringValue(contexts)) {
				finalContexts.push(contexts);
			}

			const unsignedVc = new Credential({
				context: finalContexts,
				id: credentialId,
				type: finalTypes,
				issuer: issuerDocumentId,
				credentialSubject: subject as Subject,
				credentialStatus: Is.undefined(revocationIndex)
					? undefined
					: {
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
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param requestContext The context for the request.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T>(
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const controller = issuerDocument.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					issuerDocumentId
				);
			}

			issuerDocument.revokeCredentials("revocation", credentialIndices);

			await this.updateDocument(requestContext, issuerDocument, false, controller);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const controller = issuerDocument.metadataStateControllerAddress();
			if (Is.undefined(controller)) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"stateControllerMissing",
					issuerDocumentId
				);
			}

			issuerDocument.unrevokeCredentials("revocation", credentialIndices);

			await this.updateDocument(requestContext, issuerDocument, false, controller);
		} catch (error) {
			throw new GeneralError(
				IotaIdentityConnector._CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param requestContext The context for the request.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param contexts Additional contexts to include in the presentation.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		requestContext: IRequestContext,
		presentationMethodId: string,
		types: string | string[] | undefined,
		verifiableCredentials: string[],
		contexts?: string | string[],
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
			nameof(presentationMethodId),
			presentationMethodId
		);
		if (Is.array(types)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);
		if (Is.array(contexts)) {
			Guards.arrayValue(IotaIdentityConnector._CLASS_NAME, nameof(contexts), contexts);
		} else if (Is.string(contexts)) {
			Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(contexts), contexts);
		}
		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(IotaIdentityConnector._CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}
		try {
			const hashIndex = presentationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"missingDid",
					presentationMethodId
				);
			}

			const holderDocumentId = presentationMethodId.slice(0, hashIndex);

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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

			const finalTypes = [];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const finalContexts = [];
			if (Is.array(contexts)) {
				finalContexts.push(...contexts);
			} else if (Is.stringValue(contexts)) {
				finalContexts.push(contexts);
			}

			const unsignedVp = new Presentation({
				context: finalContexts,
				verifiableCredential: verifiableCredentials.map(j => new Jwt(j)),
				type: finalTypes,
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
				this.extractPayloadError(error)
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		requestContext: IRequestContext,
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
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"missingDid",
					verificationMethodId
				);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		requestContext: IRequestContext,
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
		Guards.stringValue(
			IotaIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(IotaIdentityConnector._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(IotaIdentityConnector._CLASS_NAME, nameof(signatureValue), signatureValue);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(
					IotaIdentityConnector._CLASS_NAME,
					"missingDid",
					verificationMethodId
				);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
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
				this.extractPayloadError(error)
			);
		}
	}

	/**
	 * Sign and publish a document.
	 * @param requestContext The context for the request.
	 * @param document The document to sign and publish.
	 * @param isNewDocument Is this a new document.
	 * @param controller The controller.
	 * @returns The published document.
	 * @internal
	 */
	private async updateDocument(
		requestContext: IRequestContext,
		document: IotaDocument,
		isNewDocument: boolean,
		controller: string
	): Promise<IDidDocument> {
		const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

		document.setMetadataUpdated(Timestamp.nowUTC());
		const address = Utils.parseBech32Address(controller);

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

		const blockDetails = await this.prepareAndPostTransaction(
			requestContext,
			identityClient.client,
			{
				outputs: [aliasOutput]
			}
		);

		const networkHrp = await identityClient.getNetworkHrp();
		const published = await IotaDocument.unpackFromBlock(networkHrp, blockDetails.block);

		return published[0].toJSON() as IDidDocument;
	}

	/**
	 * Prepare a transaction for sending, post and wait for inclusion.
	 * @param requestContext The context for the request.
	 * @param client The client to use.
	 * @param options The options for the transaction.
	 * @returns The block id and block.
	 * @internal
	 */
	private async prepareAndPostTransaction(
		requestContext: IRequestContext,
		client: Client,
		options: IBuildBlockOptions
	): Promise<{ blockId: string; block: Block }> {
		const seed = await this.getSeed(requestContext);
		const secretManager = { hexSeed: Converter.bytesToHex(seed, true) };

		const prepared = await client.prepareTransaction(secretManager, {
			coinType: this._config.coinType ?? IotaIdentityConnector._DEFAULT_COIN_TYPE,
			...options
		});

		const signed = await client.signTransaction(secretManager, prepared);

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
				this.extractPayloadError(error)
			);
		}

		return {
			blockId: blockIdAndBlock[0],
			block: blockIdAndBlock[1]
		};
	}

	/**
	 * Get the seed from the vault.
	 * @param requestContext The context for the request.
	 * @returns The seed.
	 * @internal
	 */
	private async getSeed(requestContext: IRequestContext): Promise<Uint8Array> {
		try {
			const seedBase64 = await this._vaultConnector.getSecret<string>(
				requestContext,
				this._config.vaultSeedId ?? IotaIdentityConnector._DEFAULT_SEED_SECRET_NAME
			);
			return Converter.base64ToBytes(seedBase64);
		} catch {}

		const mnemonic = await this._vaultConnector.getSecret<string>(
			requestContext,
			this._config.vaultMnemonicId ?? IotaIdentityConnector._DEFAULT_MNEMONIC_SECRET_NAME
		);

		return Bip39.mnemonicToSeed(mnemonic);
	}

	/**
	 * Extract error from SDK payload.
	 * @param error The error to extract.
	 * @returns The extracted error.
	 */
	private extractPayloadError(error: unknown): IError {
		if (Is.json(error)) {
			const obj = JSON.parse(error);
			let message = obj.payload?.error;
			if (message === "no input with matching ed25519 address provided") {
				message = "There were insufficient funds to complete the operation";
			}
			return {
				name: "IOTA",
				message
			};
		}

		return BaseError.fromError(error);
	}
}

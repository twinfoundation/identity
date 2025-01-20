// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
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
	type ICredential,
	type IJwkParams,
	type Subject
} from "@iota/identity-wasm/node/index.js";
import { Client, Utils } from "@iota/sdk-wasm/node/lib/index.js";
import {
	Converter,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@twin.org/core";
import { Sha256 } from "@twin.org/crypto";
import type {
	IJsonLdContextDefinitionRoot,
	IJsonLdNodeObject,
	IJsonLdObject
} from "@twin.org/data-json-ld";
import { type IIotaConfig, Iota } from "@twin.org/dlt-iota";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidContexts,
	DidCryptoSuites,
	DidTypes,
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidProof,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType, type IVaultConnector } from "@twin.org/vault-models";
import type { IIotaIdentityConnectorConfig } from "./models/IIotaIdentityConnectorConfig";
import type { IIotaIdentityConnectorConstructorOptions } from "./models/IIotaIdentityConnectorConstructorOptions";

/**
 * Class for performing identity operations on IOTA.
 */
export class IotaIdentityConnector implements IIdentityConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "iota";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IotaIdentityConnector>();

	/**
	 * The configuration to use for tangle operations.
	 * @internal
	 */
	private readonly _config: IIotaConfig;

	/**
	 * The wallet address index to use for funding.
	 * @internal
	 */
	private readonly _walletAddressIndex: number;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * Create a new instance of IotaIdentityConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IIotaIdentityConnectorConstructorOptions) {
		Guards.object(this.CLASS_NAME, nameof(options), options);
		Guards.object<IIotaIdentityConnectorConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.object<IIotaIdentityConnectorConfig["clientOptions"]>(
			this.CLASS_NAME,
			nameof(options.config.clientOptions),
			options.config.clientOptions
		);

		this._config = options.config;
		Iota.populateConfig(this._config);

		this._walletAddressIndex = options.config.walletAddressIndex ?? 0;
		this._vaultConnector = VaultConnectorFactory.get(options.vaultConnectorType ?? "vault");
	}

	/**
	 * Create a new document.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created document.
	 */
	public async createDocument(controller: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

			const networkHrp = await identityClient.getNetworkHrp();

			const document = new IotaDocument(networkHrp);

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			const newDocument = await this.updateDocument(controller, document, true);

			return newDocument;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"createDocumentFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param controller The controller of the identity who can make changes.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		controller: string,
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.arrayOneOf<DidVerificationMethodType>(
			this.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const tempKeyId = this.buildKey(
				controller,
				`temp-vm-${Converter.bytesToBase64Url(RandomHelper.generate(16))}`
			);
			const verificationPublicKey = await this._vaultConnector.createKey(
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

			await this._vaultConnector.renameKey(tempKeyId, this.buildKey(controller, methodId.slice(1)));

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

			await this.updateDocument(controller, document, false);

			return method.toJSON() as IDidDocumentVerificationMethod;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		controller: string,
		verificationMethodId: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new NotFoundError(
					this.CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			document.removeMethod(method.id());

			await this.updateDocument(controller, document, false);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		controller: string,
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
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

			await this.updateDocument(controller, document, false);

			return service.toJSON() as IDidService;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"addServiceFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(controller: string, serviceId: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const idParts = DocumentHelper.parse(serviceId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", serviceId);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const services = document.service();
			const service = services.find(s => s.id().toString() === serviceId);

			if (!service) {
				throw new NotFoundError(this.CLASS_NAME, "serviceNotFound", serviceId);
			}

			document.removeService(service.id());

			await this.updateDocument(controller, document, false);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"removeServiceFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param id The id of the credential.
	 * @param credential The credential to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential(
		controller: string,
		verificationMethodId: string,
		id: string | undefined,
		credential: IJsonLdNodeObject,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.object<IJsonLdObject>(this.CLASS_NAME, nameof(credential), credential);
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: verificationMethodId
				});
			}

			const credentialClone = ObjectHelper.clone(credential);

			const finalTypes = [];
			const credContext = ObjectHelper.extractProperty<IJsonLdContextDefinitionRoot>(
				credentialClone,
				["@context"]
			);
			const credType = ObjectHelper.extractProperty<string>(credentialClone, ["@type", "type"]);
			if (Is.stringValue(credType)) {
				finalTypes.push(credType);
			}

			const unsignedVc = new Credential({
				context: credContext as
					| string
					| { [id: string]: unknown }
					| (string | { [id: string]: unknown })[],
				id,
				type: finalTypes,
				issuer: idParts.id,
				credentialSubject: credentialClone as unknown as Subject,
				credentialStatus: Is.undefined(revocationIndex)
					? undefined
					: {
							id: `${issuerDocument.id().toString()}#revocation`,
							type: RevocationBitmap.type(),
							revocationBitmapIndex: revocationIndex.toString()
						}
			});

			const verificationMethodKey = await this._vaultConnector.getKey(
				this.buildKey(controller, idParts.hash)
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "verificationKeyMissing", {
					method: verificationMethodId
				});
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
				verifiableCredential: decoded.credential().toJSON() as IDidVerifiableCredential,
				jwt: credentialJwt.toString()
			};
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"createVerifiableCredentialFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(credentialJwt), credentialJwt);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(credentialJwt);

			const issuerDocumentId = JwtCredentialValidator.extractIssuerFromJwt(jwt);
			const issuerDocument = await resolver.resolve(issuerDocumentId.toString());

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId.toString());
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
				verifiableCredential: credential.toJSON() as IDidVerifiableCredential
			};
		} catch (error) {
			if (error instanceof Error && error.message.toLowerCase().includes("revoked")) {
				return {
					revoked: true
				};
			}
			throw new GeneralError(
				this.CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		controller: string,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}

			issuerDocument.revokeCredentials("revocation", credentialIndices);

			await this.updateDocument(controller, issuerDocument, false);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		controller: string,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}

			issuerDocument.unrevokeCredentials("revocation", credentialIndices);

			await this.updateDocument(controller, issuerDocument, false);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param controller The controller of the identity who can make changes.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		controller: string,
		presentationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential)[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(presentationMethodId), presentationMethodId);
		if (Is.array(types)) {
			Guards.arrayValue(this.CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(this.CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(this.CLASS_NAME, nameof(verifiableCredentials), verifiableCredentials);
		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(this.CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}
		try {
			const idParts = DocumentHelper.parse(presentationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", presentationMethodId);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === presentationMethodId);
			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: presentationMethodId });
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: presentationMethodId
				});
			}

			const finalTypes = [];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const credentials = [];
			for (const cred of verifiableCredentials) {
				if (Is.stringValue(cred)) {
					credentials.push(cred);
				} else {
					credentials.push(new Credential(cred as unknown as ICredential));
				}
			}

			const unsignedVp = new Presentation({
				context: contexts as
					| string
					| { [id: string]: unknown }
					| (string | { [id: string]: unknown })[],
				id: presentationId,
				verifiableCredential: credentials,
				type: finalTypes,
				holder: idParts.id
			});

			const verificationMethodKey = await this._vaultConnector.getKey(
				this.buildKey(controller, idParts.hash)
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "verificationKeyMissing", {
					method: presentationMethodId
				});
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
				this.CLASS_NAME,
				"createVerifiablePresentationFailed",
				undefined,
				Iota.extractPayloadError(error)
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
		Guards.stringValue(this.CLASS_NAME, nameof(presentationJwt), presentationJwt);

		try {
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const resolver = await new Resolver({ client: identityClient });

			const jwt = new Jwt(presentationJwt);

			const holderId = JwtPresentationValidator.extractHolder(jwt);
			const holderDocument = await resolver.resolve(holderId.toString());

			if (Is.undefined(holderDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", holderId.toString());
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
				this.CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof.
	 */
	public async createProof(
		controller: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<IDidProof> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: verificationMethodId
				});
			}

			const jwkMemStore = new JwkMemStore();

			const verificationMethodKey = await this._vaultConnector.getKey(
				this.buildKey(controller, idParts.hash)
			);
			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			const jwkParams = new Jwk({
				alg: didMethod.publicKeyJwk.alg,
				kty: didMethod.publicKeyJwk.kty as JwkType,
				crv: didMethod.publicKeyJwk.crv,
				x: didMethod.publicKeyJwk.x,
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
			} as IJwkParams);

			const keyId = await jwkMemStore.insert(jwkParams);

			const signature = await jwkMemStore.sign(keyId, bytes, jwkParams);

			return {
				"@context": DidContexts.ContextVCDataIntegrity,
				type: DidTypes.DataIntegrityProof,
				cryptosuite: DidCryptoSuites.EdDSAJcs2022,
				created: new Date(Date.now()).toISOString(),
				verificationMethod: verificationMethodId,
				proofPurpose: "assertionMethod",
				proofValue: Converter.bytesToBase58(signature)
			};
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"createProofFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async verifyProof(bytes: Uint8Array, proof: IDidProof): Promise<boolean> {
		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);
		Guards.object(this.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.type), proof.type);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.cryptosuite), proof.cryptosuite);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.verificationMethod), proof.verificationMethod);
		Guards.stringBase58(this.CLASS_NAME, nameof(proof.proofValue), proof.proofValue);

		try {
			if (proof.type !== DidTypes.DataIntegrityProof) {
				throw new GeneralError(this.CLASS_NAME, "proofType", { proofType: proof.type });
			}
			if (proof.cryptosuite !== DidCryptoSuites.EdDSAJcs2022) {
				throw new GeneralError(this.CLASS_NAME, "cryptoSuite", { cryptosuite: proof.cryptosuite });
			}
			const idParts = DocumentHelper.parse(proof.verificationMethod);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", proof.verificationMethod);
			}

			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === proof.verificationMethod);

			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", {
					method: proof.verificationMethod
				});
			}

			const jwk = method.data().tryPublicKeyJwk();
			verifyEd25519(JwsAlgorithm.EdDSA, bytes, Converter.base58ToBytes(proof.proofValue), jwk);

			return true;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifyProofFailed",
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Sign and publish a document.
	 * @param controller The controller of the document.
	 * @param document The document to sign and publish.
	 * @param isNewDocument Is this a new document.
	 * @returns The published document.
	 * @internal
	 */
	private async updateDocument(
		controller: string,
		document: IotaDocument,
		isNewDocument: boolean
	): Promise<IDidDocument> {
		const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

		document.setMetadataUpdated(Timestamp.nowUTC());

		const addresses = await Iota.getAddresses(
			this._config,
			this._vaultConnector,
			controller,
			0,
			this._walletAddressIndex,
			1
		);

		const address = Utils.parseBech32Address(addresses[0]);

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

		const blockDetails = await Iota.prepareAndPostTransaction(
			this._config,
			this._vaultConnector,
			controller,
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
	 * Build the key name to access the specified key in vault.
	 * @param identity The identity of the user to access the vault keys.
	 * @param keyId The id of the key.
	 * @returns The vault key.
	 * @internal
	 */
	private buildKey(identity: string, keyId: string): string {
		return `${identity}/${keyId}`;
	}
}

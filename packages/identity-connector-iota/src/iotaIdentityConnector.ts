// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	Credential,
	Duration,
	IdentityClient,
	IotaDID,
	IotaDocument,
	JwkMemStore,
	JwsAlgorithm,
	JwsSignatureOptions,
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
	StorageSigner,
	SubjectHolderRelationship,
	Timestamp,
	JwtCredentialValidator,
	JwtCredentialValidationOptions,
	FailFast,
	Jwk,
	MethodDigest,
	EdDSAJwsVerifier,
	JwkType,
	Jwt,
	type CreateProposal,
	type UpdateDid,
	type OnChainIdentity,
	type ControllerToken,
	VerificationMethod,
	type DIDUrl,
	type ICredential,
	type IJwkParams,
	type IPresentation,
	type CreateIdentity
} from "@iota/identity-wasm/node/index.js";
import type { TransactionBuilder } from "@iota/iota-interaction-ts/node/transaction_internal.js";
import type { IotaClient } from "@iota/iota-sdk/client";
import {
	BaseError,
	Converter,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper,
	Url,
	Urn
} from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { Iota } from "@twin.org/dlt-iota";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidVerificationMethodType,
	ProofHelper,
	ProofTypes,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation,
	type IProof
} from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType, type IVaultConnector } from "@twin.org/vault-models";
import { Jwk as JwkHelper } from "@twin.org/web";
import { NetworkConstants } from "./constants/networkConstants";
import type { IIdentityTransactionResult } from "./models/IIdentityTransactionResult";
import type { IIotaIdentityConnectorConfig } from "./models/IIotaIdentityConnectorConfig";
import type { IIotaIdentityConnectorConstructorOptions } from "./models/IIotaIdentityConnectorConstructorOptions";
import { IotaIdentityUtils } from "./utils/iotaIdentityUtils";

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
	 * The vault for the keys.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The configuration to use for IOTA operations.
	 * @internal
	 */
	private readonly _config: IIotaIdentityConnectorConfig;

	/**
	 * The wallet address index to use for funding.
	 * @internal
	 */
	private readonly _walletAddressIndex: number;

	/**
	 * Gas budget for transactions.
	 * @internal
	 */
	private readonly _gasBudget: number;

	/**
	 * Standard gas price in nanos per computation unit.
	 * (1 Nano = 0.000000001 IOTA)
	 * @internal
	 */
	private readonly _standardGasPrice: bigint;

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
		this._vaultConnector = VaultConnectorFactory.get(options.vaultConnectorType ?? "vault");

		this._config = options.config;

		this._gasBudget = this._config.gasBudget ?? 1_000_000_000;
		this._walletAddressIndex = options.config.walletAddressIndex ?? 0;
		this._standardGasPrice = BigInt(this._config.standardGasPrice ?? 1000);

		Iota.populateConfig(this._config);
	}

	/**
	 * Create a new document.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created document.
	 */
	public async createDocument(controller: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const identityClient = await this.getIdentityClient(controller);
			const networkHrp = identityClient.network();
			const document = new IotaDocument(networkHrp);

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			const executionResult = await this.executeIdentityTransaction(
				controller,
				identityClient.createIdentity(document).finish()
			);

			const did = this.extractDidFromExecutionResult(executionResult, networkHrp);

			// Both regular and gas station transactions now use waitForTransactionConfirmation
			// so the DID should be immediately resolvable after transaction confirmation
			const resolved = await identityClient.resolveDid(did);

			const docJson = resolved.toJSON() as { doc: IDidDocument };

			return docJson.doc;
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
			const identityClient = await this.getIdentityClient(controller);
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const identity = await identityClient.getIdentity(this.extractAliasId(documentId));
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", identityOnChain);
			}

			const tempKeyId = `${controller}/temp-vm-${Date.now()}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				tempKeyId,
				VaultKeyType.Ed25519
			);

			const jwkParams = await JwkHelper.fromEd25519Public(verificationPublicKey);
			const jwk = new Jwk(jwkParams as IJwkParams);

			const methodId = `#${verificationMethodId ?? (await JwkHelper.generateKid(jwkParams))}`;

			await this._vaultConnector.renameKey(tempKeyId, `${controller}/${methodId.slice(1)}`);

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

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);

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
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = await this.getIdentityClient(controller);
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

			const identity = await identityClient.getIdentity(this.extractAliasId(idParts.id));
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", verificationMethodId);
			}

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);
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
		serviceType: string | string[],
		serviceEndpoint: string | string[]
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const identityClient = await this.getIdentityClient(controller);
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const identity = await identityClient.getIdentity(this.extractAliasId(documentId));
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", identityOnChain);
			}

			const service = new Service({
				id: `${document.id()}#${serviceId}`,
				type: serviceType,
				serviceEndpoint
			});

			document.insertService(service);

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);

			return service.toJSON() as unknown as IDidService;
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
			const idParts = DocumentHelper.parseId(serviceId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", serviceId);
			}

			const identityClient = await this.getIdentityClient(controller);
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

			const identity = await identityClient.getIdentity(this.extractAliasId(idParts.id));
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", idParts.id);
			}

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);
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
	 * @param subject The credential subject to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential(
		controller: string,
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.objectValue(this.CLASS_NAME, nameof(subject), subject);
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = await this.getIdentityClient(controller);
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const subjectClone = ObjectHelper.clone(subject);

			const credContext = ObjectHelper.extractProperty(subjectClone, "@context", true);
			const credType = ObjectHelper.extractProperty(subjectClone, ["@type", "type"], false);

			const finalTypes = [];
			if (Is.stringValue(credType)) {
				finalTypes.push(credType);
			}

			const verificationMethodKey = await this._vaultConnector.getKey(
				`${controller}/${idParts.fragment}`
			);

			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "verificationKeyMissing", {
					method: verificationMethodId
				});
			}

			if (Is.undefined(verificationMethodKey.publicKey)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMethodMissing", {
					method: verificationMethodId
				});
			}

			const jwkMemStore = new JwkMemStore();

			const jwkResult = await JwkHelper.fromEd25519Private(verificationMethodKey.privateKey);
			const jwkParams = jwkResult as IJwkParams;

			const keyId = await jwkMemStore.insert(new Jwk(jwkParams));
			const keyIdMemStore = new KeyIdMemStore();
			const methodDigest = new MethodDigest(method);
			await keyIdMemStore.insertKeyId(methodDigest, keyId);

			const storage = new Storage(jwkMemStore, keyIdMemStore);

			const subjectId = subjectClone.id;
			if (
				Is.stringValue(subjectId) &&
				!Url.tryParseExact(subjectId) &&
				!Urn.tryParseExact(subjectId)
			) {
				throw new GeneralError(this.CLASS_NAME, "invalidSubjectId", { subjectId });
			}

			const unsignedVc = new Credential({
				issuer: idParts.id,
				credentialSubject: subjectClone,
				type: finalTypes,
				id,
				context: credContext as ICredential["context"]
			});

			if (!Is.undefined(revocationIndex)) {
				Object.assign(unsignedVc, {
					credentialStatus: {
						id: `${issuerDocument.id().toString()}#revocation`,
						type: RevocationBitmap.type(),
						revocationBitmapIndex: revocationIndex.toString()
					}
				});
			}

			const credentialJwt = await issuerDocument.createCredentialJwt(
				storage,
				`#${idParts.fragment}`,
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
			throw new GeneralError(this.CLASS_NAME, "createVerifiableCredentialFailed", {
				error: BaseError.fromError(error)
			});
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
			const identityClientReadOnly = await IotaIdentityUtils.createClient(this._config);
			const resolver = new Resolver({ client: identityClientReadOnly });
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
			throw new GeneralError(this.CLASS_NAME, "checkingVerifiableCredentialFailed", {
				error: BaseError.fromError(error)
			});
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
		Guards.array(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const identityClient = await this.getIdentityClient(controller);
			const document = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}

			const serviceId = `${document.id().toString()}#revocation`;
			const revocationService = document.service().find(s => s.id().toString() === serviceId);

			if (Is.undefined(revocationService)) {
				const revocationBitmap = new RevocationBitmap();
				const service = revocationBitmap.toService(serviceId as unknown as DIDUrl);
				document.insertService(service);
			}

			document.revokeCredentials("revocation", credentialIndices);

			const aliasId = this.extractAliasId(issuerDocumentId);
			const identity = await identityClient.getIdentity(aliasId);
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", issuerDocumentId);
			}

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "revokeVerifiableCredentialsFailed", {
				error: BaseError.fromError(error)
			});
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
		Guards.array(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const identityClient = await this.getIdentityClient(controller);
			const document = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}

			const serviceId = `${document.id().toString()}#revocation`;
			const revocationService = document.service().find(s => s.id().toString() === serviceId);

			if (Is.undefined(revocationService)) {
				throw new NotFoundError(this.CLASS_NAME, "revocationServiceNotFound", serviceId);
			}

			document.unrevokeCredentials("revocation", credentialIndices);

			const aliasId = this.extractAliasId(issuerDocumentId);
			const identity = await identityClient.getIdentity(aliasId);
			const identityOnChain = identity.toFullFledged();

			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", issuerDocumentId);
			}

			const controllerToken = await identityOnChain.getControllerToken(identityClient);
			if (Is.empty(controllerToken)) {
				throw new GeneralError(this.CLASS_NAME, "missingControllerToken");
			}

			await this.executeDocumentUpdate(controller, identityOnChain, document, controllerToken);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "unrevokeVerifiableCredentialsFailed", {
				error: BaseError.fromError(error)
			});
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The method to associate with the presentation.
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
		verificationMethodId: string,
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
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
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
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = await this.getIdentityClient(controller);
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
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMethodMissing", {
					method: verificationMethodId
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
				context: contexts as IPresentation["context"],
				id: presentationId,
				verifiableCredential: credentials,
				type: finalTypes,
				holder: idParts.id
			});

			const verificationMethodKey = await this._vaultConnector.getKey(
				`${controller}/${idParts.fragment}`
			);

			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "verificationKeyMissing", {
					method: verificationMethodId
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
			const jwk = new Jwk(jwkParams);
			const publicKeyJwk = jwk.toPublic();
			if (!publicKeyJwk) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					jwk: jwk.kid()
				});
			}
			const keyId = await jwkMemStore.insert(jwk);
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
			const identityClientReadOnly = await IotaIdentityUtils.createClient(this._config);
			const resolver = new Resolver<IotaDocument>({ client: identityClientReadOnly });
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

			const credentialValidator = new JwtCredentialValidator(new EdDSAJwsVerifier());
			const validationOptions = new JwtCredentialValidationOptions({
				subjectHolderRelationship: [holderId.toString(), SubjectHolderRelationship.AlwaysSubject]
			});

			const jwtCredentials: Jwt[] = decoded
				.presentation()
				.verifiableCredential()
				.map(credential => {
					const jwtCredential = credential.tryIntoJwt();
					if (jwtCredential) {
						return jwtCredential;
					}
					return null;
				})
				.filter(Boolean) as Jwt[];

			const issuers: string[] = [];

			for (const jwtCredential of jwtCredentials) {
				const issuer = JwtCredentialValidator.extractIssuerFromJwt(jwtCredential);
				issuers.push(issuer.toString());
			}

			const resolvedIssuers = await resolver.resolveMultiple(issuers);

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
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @returns The proof.
	 */
	public async createProof(
		controller: string,
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject
	): Promise<IProof> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.arrayOneOf<ProofTypes>(
			this.CLASS_NAME,
			nameof(proofType),
			proofType,
			Object.values(ProofTypes)
		);
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(unsecureDocument), unsecureDocument);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const identityClient = await this.getIdentityClient(controller);
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const keyId = `${controller}/${idParts.fragment}`;
			const verificationMethodKey = await this._vaultConnector.getKey(keyId);

			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "privateKeyMissing", { keyId });
			}

			const unsignedProof = ProofHelper.createUnsignedProof(proofType, verificationMethodId);

			const jwk = await JwkHelper.fromEd25519Private(verificationMethodKey.privateKey);
			const signedProof = await ProofHelper.createProof(
				proofType,
				unsecureDocument,
				unsignedProof,
				jwk
			);
			return signedProof;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"createProofFailed",
				{ controller, verificationMethodId, proofType },
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async verifyProof(document: IJsonLdNodeObject, proof: IProof): Promise<boolean> {
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(document), document);
		Guards.object<IProof>(this.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.verificationMethod), proof.verificationMethod);

		try {
			const idParts = DocumentHelper.parseId(proof.verificationMethod);

			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", proof.verificationMethod);
			}

			const identityClient = await this.getIdentityClient();
			const resolvedDocument = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(resolvedDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = resolvedDocument.methods();
			const method = methods.find(m => m.id().toString() === proof.verificationMethod);

			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", {
					method: proof.verificationMethod
				});
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMethodMissing", {
					method: proof.verificationMethod
				});
			}

			return ProofHelper.verifyProof(document, proof, didMethod.publicKeyJwk);
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
	 * Get an identity client.
	 * @param controller The controller to get the client for.
	 * @returns The identity client.
	 * @internal
	 */
	private async getIdentityClient(controller?: string): Promise<IdentityClient> {
		const identityClientReadOnly = await IotaIdentityUtils.createClient(this._config);

		if (Is.undefined(controller)) {
			const jwkMemStore = new JwkMemStore();
			const keyIdMemStore = new KeyIdMemStore();
			const storage = new Storage(jwkMemStore, keyIdMemStore);

			// Create a proper no-op signer with valid but empty keys
			const noOpJwkParams: IJwkParams = {
				kty: JwkType.Okp,
				crv: "Ed25519",
				alg: JwsAlgorithm.EdDSA,
				x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // Base64 encoded empty 32-byte array
				d: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
			};
			const noOpJwk = new Jwk(noOpJwkParams);
			const signer = new StorageSigner(storage, "", noOpJwk);
			return IdentityClient.create(identityClientReadOnly, signer);
		}

		const seed = await Iota.getSeed(this._config, this._vaultConnector, controller);

		const kp = Iota.getKeyPair(
			seed,
			this._config.coinType ?? Iota.DEFAULT_COIN_TYPE,
			0,
			this._walletAddressIndex,
			false
		);

		const jwkMemStore = new JwkMemStore();
		const keyIdMemStore = new KeyIdMemStore();
		const storage = new Storage(jwkMemStore, keyIdMemStore);

		const jwkParams: IJwkParams = {
			kty: JwkType.Okp,
			crv: "Ed25519",
			alg: JwsAlgorithm.EdDSA,
			x: Converter.bytesToBase64Url(kp.publicKey),
			d: Converter.bytesToBase64Url(kp.privateKey)
		};

		const jwk = new Jwk(jwkParams);
		const publicKeyJwk = jwk.toPublic();
		if (!publicKeyJwk) {
			throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
				jwk: jwk.kid()
			});
		}
		const keyId = await jwkMemStore.insert(jwk);
		const signer = new StorageSigner(storage, keyId, publicKeyJwk);
		return IdentityClient.create(identityClientReadOnly, signer);
	}

	/**
	 * Get the IOTA client for transaction operations.
	 * @returns The IOTA client.
	 * @internal
	 */
	private getIotaClient(): IotaClient {
		return Iota.createClient(this._config);
	}

	/**
	 * Extract DID from execution result, handling both regular and gas station transaction formats.
	 * @param executionResult The transaction execution result.
	 * @param networkHrp The network HRP for DID construction.
	 * @returns The extracted DID.
	 * @throws GeneralError if the execution result format is unexpected.
	 * @internal
	 */
	private extractDidFromExecutionResult(
		executionResult: IIdentityTransactionResult,
		networkHrp: string
	): IotaDID {
		if (Is.function(executionResult.output?.didDocument)) {
			return executionResult.output.didDocument().id();
		}

		if (Is.arrayValue(executionResult.response?.objectChanges)) {
			const resultNetworkHrp = ObjectHelper.propertyGet<string>(executionResult, "networkHrp");
			const did = this.tryExtractDidFromObjectChanges(
				executionResult.response.objectChanges,
				resultNetworkHrp ?? networkHrp,
				executionResult.response.effects?.transactionDigest
			);

			if (did) {
				return did;
			}
		}

		throw new GeneralError(this.CLASS_NAME, "didExtractionFailed", {
			resultType: typeof executionResult,
			availableKeys: Object.keys(executionResult ?? {}),
			hasOutput: Is.object(executionResult.output),
			hasResponse: Is.object(executionResult.response),
			hasObjectChanges: Is.arrayValue(executionResult.response?.objectChanges),
			gasStationConfig: Is.object(this._config.gasStation)
		});
	}

	/**
	 * Attempts to extract DID from transaction object changes.
	 * @param objectChanges The object changes from the transaction response.
	 * @param transactionDigest The transaction digest for logging.
	 * @returns The DID if found, undefined otherwise.
	 * @internal
	 */
	private tryExtractDidFromObjectChanges(
		objectChanges: unknown[],
		networkHrp?: string,
		transactionDigest?: string
	): IotaDID | undefined {
		const identityObject = objectChanges.find(change => {
			if (!Is.object(change)) {
				return false;
			}

			const changeType = ObjectHelper.propertyGet<string>(change, "type");
			const objectType = ObjectHelper.propertyGet<string>(change, "objectType");

			if (
				changeType === "created" &&
				Is.stringValue(objectType) &&
				objectType.includes("::identity::Identity")
			) {
				return true;
			}

			return false;
		});

		if (Is.object(identityObject)) {
			const objectId = ObjectHelper.propertyGet<string>(identityObject, "objectId");

			if (Is.stringValue(objectId)) {
				if (Is.stringValue(networkHrp)) {
					return this.constructDid(networkHrp, objectId);
				}

				return IotaDID.parse(`did:iota:${objectId}`);
			}
		}

		return undefined;
	}

	/**
	 * Constructs a DID following the IOTA DID Method Specification v2.0.
	 * For mainnet, omits network identifier (canonical format).
	 * For testnet/devnet, includes network identifier.
	 * @param networkHrp The network HRP.
	 * @param objectId The object ID.
	 * @returns The constructed DID.
	 * @internal
	 */
	private constructDid(networkHrp: string, objectId: string): IotaDID {
		if (networkHrp === NetworkConstants.MAINNET_NETWORK_ID) {
			return IotaDID.parse(`did:iota:${objectId}`);
		}

		return IotaDID.parse(`did:iota:${networkHrp}:${objectId}`);
	}

	/**
	 * Extract alias id from document id.
	 * @param documentId The id of the document.
	 * @returns The alias id.
	 * @internal
	 */
	private extractAliasId(documentId: string): string {
		const didUrn = Urn.fromValidString(documentId);
		const didParts = didUrn.parts();
		return didParts[didParts.length - 1];
	}

	/**
	 * Execute identity transaction with conditional gas station support.
	 * @param controller The controller identity.
	 * @param transactionBuilder The finished transaction builder from createIdentity().finish().
	 * @returns The execution result.
	 * @internal
	 */
	private async executeIdentityTransaction(
		controller: string,
		transactionBuilder: TransactionBuilder<CreateIdentity>
	): Promise<IIdentityTransactionResult> {
		if (Is.object(this._config.gasStation)) {
			return this.executeIdentityTransactionWithGasStation(controller, transactionBuilder);
		}

		const identityClient = await this.getIdentityClient(controller);

		const buildResult = await transactionBuilder.build(identityClient);

		if (Is.arrayValue(buildResult) && buildResult.length === 3 && Is.uint8Array(buildResult[0])) {
			const [txBytes, signatures, createIdentity] = buildResult;

			if (Is.arrayValue(signatures)) {
				const iotaClient = this.getIotaClient();

				const txResponse = await iotaClient.executeTransactionBlock({
					transactionBlock: txBytes,
					signature: signatures,
					options: {
						showEffects: true,
						showEvents: true,
						showObjectChanges: true
					}
				});

				const confirmedTx = await Iota.waitForTransactionConfirmation(
					iotaClient,
					txResponse.digest,
					this._config
				);

				if (!confirmedTx) {
					throw new GeneralError(
						this.CLASS_NAME,
						"transactionConfirmationTimeout",
						undefined,
						txResponse.digest
					);
				}

				const result = {
					output: createIdentity,
					response: txResponse,
					networkHrp: identityClient.network()
				};

				return result as unknown as IIdentityTransactionResult;
			}
		}

		throw new GeneralError(
			this.CLASS_NAME,
			"transactionBuildFailed",
			{
				buildResultType: typeof buildResult,
				isArray: Is.arrayValue(buildResult),
				length: Is.arrayValue(buildResult) ? buildResult.length : 0,
				hasUint8Array: Is.arrayValue(buildResult) && Is.uint8Array(buildResult[0])
			},
			Iota.extractPayloadError(buildResult)
		);
	}

	/**
	 * Execute identity transaction with gas station sponsoring.
	 * @param controller The controller identity.
	 * @param transactionBuilder The finished transaction builder.
	 * @returns The execution result.
	 * @internal
	 */
	private async executeIdentityTransactionWithGasStation(
		controller: string,
		transactionBuilder: TransactionBuilder<CreateIdentity>
	): Promise<IIdentityTransactionResult> {
		return this.executeGasStationTransaction(controller, transactionBuilder, "identity");
	}

	/**
	 * Get user address for the given controller.
	 * @param controller The controller to get the address for.
	 * @returns The user address.
	 * @internal
	 */
	private async getUserAddress(controller: string): Promise<string> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		const seed = await Iota.getSeed(this._config, this._vaultConnector, controller);
		const addresses = Iota.getAddresses(
			seed,
			this._config.coinType ?? Iota.DEFAULT_COIN_TYPE,
			0,
			this._walletAddressIndex,
			1,
			false
		);
		return addresses[0];
	}

	/**
	 * Execute document update transaction with conditional gas station support.
	 * @param controller The controller identity.
	 * @param identityOnChain The on-chain identity to update.
	 * @param document The document to update.
	 * @param controllerToken The controller token.
	 * @returns The execution result.
	 * @internal
	 */
	private async executeDocumentUpdate(
		controller: string,
		identityOnChain: OnChainIdentity,
		document: IotaDocument,
		controllerToken: ControllerToken
	): Promise<IIdentityTransactionResult> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.object(this.CLASS_NAME, nameof(identityOnChain), identityOnChain);
		Guards.object(this.CLASS_NAME, nameof(document), document);
		Guards.object(this.CLASS_NAME, nameof(controllerToken), controllerToken);

		const updateBuilder = identityOnChain
			.updateDidDocument(document.clone(), controllerToken)
			.withGasBudget(BigInt(this._gasBudget));

		if (Is.object(this._config.gasStation)) {
			return this.executeDocumentUpdateWithGasStation(controller, updateBuilder);
		}

		const identityClient = await this.getIdentityClient(controller);
		return updateBuilder.buildAndExecute(identityClient) as unknown as IIdentityTransactionResult;
	}

	/**
	 * Execute document update transaction with gas station sponsoring.
	 * @param controller The controller identity.
	 * @param updateBuilder The document update builder.
	 * @returns The execution result.
	 * @internal
	 */
	private async executeDocumentUpdateWithGasStation(
		controller: string,
		updateBuilder: TransactionBuilder<CreateProposal<UpdateDid>>
	): Promise<IIdentityTransactionResult> {
		return this.executeGasStationTransaction(controller, updateBuilder, "update");
	}

	/**
	 * Execute a transaction with gas station sponsoring (consolidated method).
	 * @param controller The controller identity.
	 * @param builder The transaction builder (either finished identity builder or update builder).
	 * @param operationType The type of operation for error messaging and result formatting.
	 * @returns The execution result.
	 * @internal
	 */
	private async executeGasStationTransaction(
		controller: string,
		builder: TransactionBuilder<CreateIdentity> | TransactionBuilder<CreateProposal<UpdateDid>>,
		operationType: "identity" | "update"
	): Promise<IIdentityTransactionResult> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.object(this.CLASS_NAME, nameof(builder), builder);

		try {
			const identityClient = await this.getIdentityClient(controller);

			// Get user address for gas station, as the user remains the sender
			const userAddress = await this.getUserAddress(controller);

			const gasReservation = await Iota.reserveGas(this._config, this._gasBudget);

			const gasCoinsWithStringVersions = gasReservation.gasCoins.map(coin => ({
				objectId: coin.objectId,
				version: String(coin.version),
				digest: coin.digest
			}));

			const gasConfiguredBuilder = builder
				.withSender(userAddress)
				.withGasBudget(BigInt(this._gasBudget))
				.withGasOwner(gasReservation.sponsorAddress)
				.withGasPayment(gasCoinsWithStringVersions)
				.withGasPrice(this._standardGasPrice);

			const buildResult = await gasConfiguredBuilder.build(identityClient);

			if (Is.arrayValue(buildResult) && buildResult.length === 3 && Is.uint8Array(buildResult[0])) {
				const [txBytes, signatures] = buildResult;
				const iotaClient = this.getIotaClient();

				const confirmedResponse = await Iota.executeAndConfirmGasStationTransaction(
					this._config,
					iotaClient,
					gasReservation.reservationId,
					txBytes,
					signatures[0],
					{
						waitForConfirmation: true,
						showEffects: true,
						showEvents: true,
						showObjectChanges: true
					}
				);

				if (operationType === "identity") {
					// For identity creation, include the output and network HRP
					const createIdentity = buildResult[2];
					const result = {
						output: createIdentity,
						response: confirmedResponse,
						networkHrp: identityClient.network()
					};
					return result as unknown as IIdentityTransactionResult;
				}

				return confirmedResponse as unknown as IIdentityTransactionResult;
			}

			throw new GeneralError(
				this.CLASS_NAME,
				"gasStationTransactionBuildFailed",
				{
					buildResultType: typeof buildResult,
					isArray: Is.arrayValue(buildResult),
					length: Is.arrayValue(buildResult) ? buildResult.length : 0
				},
				Iota.extractPayloadError(buildResult)
			);
		} catch (error) {
			const errorMessage =
				operationType === "identity"
					? "gasStationTransactionFailed"
					: "gasStationDocumentUpdateFailed";

			throw new GeneralError(
				this.CLASS_NAME,
				errorMessage,
				undefined,
				Iota.extractPayloadError(error)
			);
		}
	}
}

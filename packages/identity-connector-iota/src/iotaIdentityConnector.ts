// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IotaDocument,
	Duration,
	IdentityClientReadOnly,
	JwsAlgorithm,
	KeyIdMemStore,
	JwkMemStore,
	JwtPresentationOptions,
	JwtPresentationValidationOptions,
	JwtPresentationValidator,
	Storage,
	VerificationMethod,
	MethodScope,
	RevocationBitmap,
	IotaDID,
	IdentityClient,
	StorageSigner,
	Presentation,
	Resolver,
	Service,
	Credential,
	JwsSignatureOptions,
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
	type IJwkParams,
	type DIDUrl
} from "@iota/identity-wasm/node";
import { IotaClient } from "@iota/iota-sdk/client";
import { getFaucetHost, requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { GeneralError, Guards, Is, NotFoundError, Converter } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { Iota } from "@twin.org/dlt-iota";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IProof,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation,
	ProofTypes,
	ProofHelper,
	type IJsonWebSignature2020Proof
} from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, type IVaultConnector, VaultKeyType } from "@twin.org/vault-models";
import { type IWalletConnector, WalletConnectorFactory } from "@twin.org/wallet-models";
import { Jwk as JwkHelper } from "@twin.org/web";
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
	 * Default package IDs for different networks.
	 */
	private static readonly _DEFAULT_IDENTITY_PKG_IDS = {
		/**
		 * Default package ID for testnet.
		 */
		TESTNET: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555",

		/**
		 * Default package ID for devnet.
		 */
		DEVNET: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"
	};

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
	 * The wallet connector.
	 * @internal
	 */
	private readonly _walletConnector: IWalletConnector;

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
	private readonly _gasBudget: bigint;

	/**
	 * The IOTA client.
	 * @internal
	 */
	private _identityClient?: IdentityClient;

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
		this._walletConnector = WalletConnectorFactory.get(options.walletConnectorType ?? "wallet");

		this._config = options.config;
		this._gasBudget = this._config.gasBudget ?? 1000000000n;
		this._walletAddressIndex = options.config.walletAddressIndex ?? 0;

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
			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);

			const networkHrp = identityClient.network();
			const document = new IotaDocument(networkHrp);

			const revocationBitmap = new RevocationBitmap();
			const revocationServiceId = document.id().join("#revocation");
			document.insertService(revocationBitmap.toService(revocationServiceId));

			const { output: identity } = await identityClient
				.createIdentity(document)
				.finish()
				.execute(identityClient);

			const did: IotaDID = identity.didDocument().id();
			identity.id();

			const resolved = await identityClient.resolveDid(did);

			const doc = resolved.toJSON() as { doc: IDidDocument };
			return doc.doc;
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
			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const identity = await identityClient.getIdentity(documentId.split(":")[3]);
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", identityOnChain);
			}

			const tempKeyId = `${controller}:temp-vm-${Date.now()}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				tempKeyId,
				VaultKeyType.Ed25519
			);

			const jwkParams: IJwkParams = {
				alg: JwsAlgorithm.EdDSA,
				kty: JwkType.Okp,
				crv: "Ed25519",
				x: Converter.bytesToBase64Url(verificationPublicKey)
			};

			const jwk = new Jwk(jwkParams);
			const methodId = `#${verificationMethodId ?? Converter.bytesToBase64Url(verificationPublicKey)}`;

			await this._vaultConnector.renameKey(tempKeyId, `${controller}:${methodId.slice(1)}`);

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

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);

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

			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
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

			const identity = await identityClient.getIdentity(idParts.id.split(":")[3]);
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", idParts.id);
			}

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);
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
			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const identity = await identityClient.getIdentity(documentId.split(":")[3]);
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

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);

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

			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
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

			const identity = await identityClient.getIdentity(idParts.id.split(":")[3]);
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", idParts.id);
			}

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);
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

			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
			const issuerDocument = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = issuerDocument.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);
			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const subjectClone = { ...subject };

			const credContext = subjectClone["@context"];
			const credType = subjectClone["@type"] || subjectClone.type;

			const finalTypes = ["VerifiableCredential"];
			if (Is.stringValue(credType)) {
				finalTypes.push(credType);
			}

			const verificationMethodKey = await this._vaultConnector.getKey(
				`${controller}:${idParts.fragment}`
			);

			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "verificationKeyMissing", {
					method: verificationMethodId
				});
			}

			const jwkMemStore = new JwkMemStore();

			const jwkParams: IJwkParams = {
				kty: JwkType.Okp,
				crv: "Ed25519",
				alg: JwsAlgorithm.EdDSA,
				x: verificationMethodKey.publicKey
					? Converter.bytesToBase64Url(verificationMethodKey.publicKey)
					: "",
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
			};

			const keyId = await jwkMemStore.insert(new Jwk(jwkParams));
			const keyIdMemStore = new KeyIdMemStore();
			const methodDigest = new MethodDigest(method);
			await keyIdMemStore.insertKeyId(methodDigest, keyId);

			const storage = new Storage(jwkMemStore, keyIdMemStore);

			const unsignedVc = new Credential({
				issuer: idParts.id,
				credentialSubject: subjectClone,
				type: finalTypes,
				...(id ? { id } : {}),
				...(credContext ? { context: credContext } : {})
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
				error: error instanceof Error ? error.message : String(error)
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
			const identityClient = await this.getFundedClient();
			const resolver = new Resolver({ client: identityClient });
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
				error: error instanceof Error ? error.message : String(error)
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
			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
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

			for (const index of credentialIndices) {
				document.revokeCredentials("revocation", index);
			}

			const aliasId = issuerDocumentId.split(":")[3];
			const identity = await identityClient.getIdentity(aliasId);
			const identityOnChain = identity.toFullFledged();
			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", issuerDocumentId);
			}

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "revokeVerifiableCredentialsFailed", {
				error: error instanceof Error ? error.message : String(error)
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
			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
			const document = await identityClient.resolveDid(IotaDID.parse(issuerDocumentId));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}

			const serviceId = `${document.id().toString()}#revocation`;
			const revocationService = document.service().find(s => s.id().toString() === serviceId);

			if (Is.undefined(revocationService)) {
				throw new NotFoundError(this.CLASS_NAME, "revocationServiceNotFound", serviceId);
			}

			for (const index of credentialIndices) {
				document.unrevokeCredentials("revocation", index);
			}

			const aliasId = issuerDocumentId.split(":")[3];
			const identity = await identityClient.getIdentity(aliasId);
			const identityOnChain = identity.toFullFledged();

			if (Is.undefined(identityOnChain)) {
				throw new NotFoundError(this.CLASS_NAME, "identityNotFound", issuerDocumentId);
			}

			await identityOnChain
				.updateDidDocument(document.clone())
				.withGasBudget(this._gasBudget)
				.execute(identityClient)
				.then(result => result.output);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "unrevokeVerifiableCredentialsFailed", {
				error: error instanceof Error ? error.message : String(error)
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

			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
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
					credentials.push(cred);
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
				`${controller}:${idParts.fragment}`
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
			const iotaClient = new IotaClient(this._config.clientOptions);
			const identityClientReadOnly = await IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				this.getIdentityPkgId()
			);
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
				// TODO: Find out if this should be AwaysSubject or Any?
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

			const controllerAddress = await this.getControllerAddress(controller);
			const identityClient = await this.getFundedClient(controllerAddress, controller);
			const document = await identityClient.resolveDid(IotaDID.parse(idParts.id));

			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}

			const methods = document.methods();
			const method = methods.find(m => m.id().toString() === verificationMethodId);

			if (!method) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const keyId = `${controller}:${idParts.fragment}`;
			const verificationMethodKey = await this._vaultConnector.getKey(keyId);

			if (Is.undefined(verificationMethodKey)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", { keyId });
			}

			const jwkMemStore = new JwkMemStore();

			const jwkParams: IJwkParams = {
				kty: JwkType.Okp,
				crv: "Ed25519",
				alg: JwsAlgorithm.EdDSA,
				x: verificationMethodKey.publicKey
					? Converter.bytesToBase64Url(verificationMethodKey.publicKey)
					: "",
				d: Converter.bytesToBase64Url(verificationMethodKey.privateKey)
			};

			const keyIdStore = await jwkMemStore.insert(new Jwk(jwkParams));
			const keyIdMemStore = new KeyIdMemStore();
			const methodDigest = new MethodDigest(method);

			await keyIdMemStore.insertKeyId(methodDigest, keyIdStore);

			const storage = new Storage(jwkMemStore, keyIdMemStore);
			const unsignedProof = ProofHelper.createUnsignedProof(proofType, verificationMethodId);

			if (proofType === ProofTypes.JsonWebSignature2020) {
				const jws = await document.createJws(
					storage,
					`#${idParts.fragment}`,
					JSON.stringify(unsecureDocument),
					new JwsSignatureOptions()
				);
				const proof: IJsonWebSignature2020Proof = {
					...(unsignedProof as IJsonWebSignature2020Proof),
					jws: jws.toString()
				};

				return proof;
			}

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

			const identityClient = await this.getFundedClient();
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

			if (proof.type === ProofTypes.JsonWebSignature2020) {
				const jwsProof = proof as IJsonWebSignature2020Proof;
				if (!jwsProof.jws) {
					throw new GeneralError(this.CLASS_NAME, "jwsMissing", {
						method: proof.verificationMethod
					});
				}
				const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
				if (Is.undefined(didMethod?.publicKeyJwk)) {
					throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
						method: proof.verificationMethod
					});
				}

				return ProofHelper.verifyProof(document, proof, didMethod.publicKeyJwk);
			}

			const didMethod = method.toJSON() as IDidDocumentVerificationMethod;
			if (Is.undefined(didMethod.publicKeyJwk)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
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
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const iotaClient = new IotaClient(this._config.clientOptions);
			const identityClientReadOnly = await IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				this.getIdentityPkgId()
			);
			const resolver = new Resolver<IotaDocument>({
				client: identityClientReadOnly
			});
			const resolvedDocument = await resolver.resolve(documentId);
			const doc = resolvedDocument.toJSON() as { doc: IDidDocument };

			return doc.doc;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"resolveDocumentFailed",
				{ documentId },
				Iota.extractPayloadError(error)
			);
		}
	}

	/**
	 * Get the address for a controller.
	 * @param controller The controller to get the address for.
	 * @returns The address for the controller.
	 */
	private async getControllerAddress(controller: string): Promise<string> {
		const addresses = await this._walletConnector.getAddresses(
			controller,
			0,
			this._walletAddressIndex,
			1
		);
		return addresses[0];
	}

	/**
	 * Get a funded client.
	 * @param controllerAddress The address of the controller.
	 * @param controller The controller to get the client for.
	 * @returns The funded client.
	 */
	private async getFundedClient(
		controllerAddress?: string,
		controller?: string
	): Promise<IdentityClient> {
		const MIN_BALANCE = 1000000000n;
		const MIN_TRANSFER_AMOUNT = 1100000000n;

		const iotaClient = new IotaClient(this._config.clientOptions);

		if (this._identityClient) {
		} else {
			const identityClientReadOnly = await IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				this.getIdentityPkgId()
			);
			const storage = new Storage(new JwkMemStore(), new KeyIdMemStore());
			const generate = await storage.keyStorage().generate("Ed25519", JwsAlgorithm.EdDSA);
			const publicKeyJwk = generate.jwk().toPublic();

			if (publicKeyJwk === undefined) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					jwk: generate.jwk().kid()
				});
			}

			const keyId = generate.keyId();
			const signer = new StorageSigner(storage, keyId, publicKeyJwk);
			const identityClient = await IdentityClient.create(identityClientReadOnly, signer);

			this._identityClient = identityClient;
		}

		const senderAddress = this._identityClient.senderAddress();

		if (controllerAddress && controller && senderAddress !== controllerAddress) {
			let senderBalance = await iotaClient.getBalance({
				owner: senderAddress
			});
			// eslint-disable-next-line no-console
			console.log("Initial sender balance", senderBalance);

			const controllerBalance = await iotaClient.getBalance({
				owner: controllerAddress
			});
			// eslint-disable-next-line no-console
			console.log("Controller balance", controllerBalance);

			// TODO: Use the Faucet to fund both addresses
			// We use the transfer for now to avoid the faucet rate limit
			if (BigInt(controllerBalance.totalBalance) < MIN_BALANCE) {
				// eslint-disable-next-line no-console
				console.log("Requesting IOTA from FAUCET");
				await requestIotaFromFaucetV0({
					host: getFaucetHost(this._config.network),
					recipient: controllerAddress
				});

				// Wait for the transaction to be processed
				await new Promise(resolve => setTimeout(resolve, 5000));
			}

			if (BigInt(controllerBalance.totalBalance) < MIN_BALANCE) {
				throw new GeneralError(this.CLASS_NAME, "failedToReceiveGasFromFaucet");
			}

			if (BigInt(senderBalance.totalBalance) < MIN_BALANCE) {
				try {
					const response = await this._walletConnector.transfer(
						controller,
						controllerAddress,
						senderAddress,
						MIN_TRANSFER_AMOUNT
					);
					// eslint-disable-next-line no-console
					console.log("Transfer Successful", response);
				} catch (error) {
					// eslint-disable-next-line no-console
					console.log("Error transferring IOTA", error);
				}

				// Wait for the transaction to be processed
				await new Promise(resolve => setTimeout(resolve, 5000));

				senderBalance = await iotaClient.getBalance({
					owner: senderAddress
				});
				// eslint-disable-next-line no-console
				console.log("Transfer successful", senderBalance);

				if (BigInt(senderBalance.totalBalance) < MIN_BALANCE) {
					throw new GeneralError(this.CLASS_NAME, "failedToReceiveGasFromFaucet");
				}
			}
		}
		return this._identityClient;
	}

	/**
	 * Gets the identity package ID to use, either from config or defaults.
	 * @returns The identity package ID.
	 */
	private getIdentityPkgId(): string {
		if (this._config.identityPkgId) {
			return this._config.identityPkgId;
		}

		const clientOptions = this._config.clientOptions;
		const url =
			typeof clientOptions === "object" && "url" in clientOptions
				? (clientOptions.url as string)
				: "";

		const isTestnet = url.includes("testnet");

		return isTestnet
			? IotaIdentityConnector._DEFAULT_IDENTITY_PKG_IDS.TESTNET
			: IotaIdentityConnector._DEFAULT_IDENTITY_PKG_IDS.DEVNET;
	}
}

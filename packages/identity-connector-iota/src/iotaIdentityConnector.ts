// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IotaDocument,
	IdentityClient,
	IdentityClientReadOnly,
	StorageSigner,
	JwsAlgorithm,
	KeyIdMemStore,
	JwkMemStore,
	Storage,
	type IotaDID
} from "@iota/identity-wasm/node";
import { IotaClient } from "@iota/iota-sdk/client";
import { GeneralError, Guards, NotImplementedError } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { Iota } from "@twin.org/dlt-iota";
import type { IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type {
	DidVerificationMethodType,
	IDidDocument,
	IDidDocumentVerificationMethod,
	IDidProof,
	IDidService,
	IDidVerifiableCredential,
	IDidVerifiablePresentation
} from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, type IVaultConnector } from "@twin.org/vault-models";
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
	 * The package id for the identity client.
	 */
	private static readonly _IOTA_IDENTITY_PKG_ID: string =
		"0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555"; // testnet

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

		this._vaultConnector = VaultConnectorFactory.get(options.vaultConnectorType ?? "vault");
		this._walletAddressIndex = options.config.walletAddressIndex ?? 0;
	}

	/**
	 * Create a new document.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created document.
	 */
	public async createDocument(controller: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			// Create a new client to connect to IOTA network
			const iotaClient = new IotaClient(this._config.clientOptions);
			const network = await iotaClient.getChainIdentifier();

			const unpublished = new IotaDocument(network);

			const identityClientReadOnly = await IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				IotaIdentityConnector._IOTA_IDENTITY_PKG_ID
			);

			const storage = new Storage(new JwkMemStore(), new KeyIdMemStore());

			const generate = await storage.keyStorage().generate("Ed25519", JwsAlgorithm.EdDSA);

			const publicKeyJwk = generate.jwk().toPublic();

			if (publicKeyJwk === undefined) {
				throw new TypeError("failed to derive public JWK from generated JWK");
			}
			const keyId = generate.keyId();

			const signer = new StorageSigner(storage, keyId, publicKeyJwk);
			const identityClient = await IdentityClient.create(identityClientReadOnly, signer);

			// Create and publish the identity
			const { output: identity } = await identityClient
				.createIdentity(unpublished)
				.finish()
				.execute(identityClient);

			const did: IotaDID = identity.didDocument().id();

			// check if we can resolve it via client
			const resolved = await identityClient.resolveDid(did);
			// eslint-disable-next-line no-console
			console.log({ resolved });

			// Convert to standard DID Document format
			const didDocument = identity.didDocument().toJSON() as IDidDocument;
			// eslint-disable-next-line no-console
			console.log({ didDocument });

			return didDocument;
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
		throw new NotImplementedError(this.CLASS_NAME, "addVerificationMethod");
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
		throw new NotImplementedError(this.CLASS_NAME, "removeVerificationMethod");
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
		throw new NotImplementedError(this.CLASS_NAME, "addService");
	}

	/**
	 * Remove a service from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(controller: string, serviceId: string): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "removeService");
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
		throw new NotImplementedError(this.CLASS_NAME, "createVerifiableCredential");
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
		throw new NotImplementedError(this.CLASS_NAME, "checkVerifiableCredential");
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
		throw new NotImplementedError(this.CLASS_NAME, "revokeVerifiableCredentials");
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
		throw new NotImplementedError(this.CLASS_NAME, "unrevokeVerifiableCredentials");
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
		throw new NotImplementedError(this.CLASS_NAME, "createVerifiablePresentation");
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
		throw new NotImplementedError(this.CLASS_NAME, "checkVerifiablePresentation");
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
		throw new NotImplementedError(this.CLASS_NAME, "createProof");
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async verifyProof(bytes: Uint8Array, proof: IDidProof): Promise<boolean> {
		throw new NotImplementedError(this.CLASS_NAME, "verifyProof");
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		throw new NotImplementedError(this.CLASS_NAME, "resolveDocument");
	}
}

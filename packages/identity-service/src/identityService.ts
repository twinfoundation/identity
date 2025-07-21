// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is, Urn } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
import {
	DocumentHelper,
	IdentityConnectorFactory,
	type IIdentityComponent,
	type IIdentityConnector
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidVerificationMethodType,
	ProofTypes,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IProof,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@twin.org/standards-w3c-did";
import { Jwt } from "@twin.org/web";
import type { IIdentityServiceConstructorOptions } from "./models/IIdentityServiceConstructorOptions";

/**
 * Class which implements the identity contract.
 */
export class IdentityService implements IIdentityComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * The default namespace for the connector to use.
	 * @internal
	 */
	private readonly _defaultNamespace: string;

	/**
	 * Create a new instance of IdentityService.
	 * @param options The options for the service.
	 */
	constructor(options?: IIdentityServiceConstructorOptions) {
		const names = IdentityConnectorFactory.names();
		if (names.length === 0) {
			throw new GeneralError(this.CLASS_NAME, "noConnectors");
		}

		this._defaultNamespace = options?.config?.defaultNamespace ?? names[0];
	}

	/**
	 * Create a new identity.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created identity document.
	 */
	public async identityCreate(namespace?: string, controller?: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const identityConnector = this.getConnectorByNamespace(namespace);
			return identityConnector.createDocument(controller);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "identityCreateFailed", undefined, error);
		}
	}

	/**
	 * Remove an identity.
	 * @param identity The id of the document to remove.
	 * @param controller The controller of the identity who can make changes.
	 * @returns Nothing.
	 */
	public async identityRemove(identity: string, controller?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const identityConnector = this.getConnectorByUri(identity);
			return identityConnector.removeDocument(controller, identity);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "identityRemoveFailed", { identity }, error);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param identity The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async verificationMethodCreate(
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string,
		controller?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(identity), identity);

		Guards.arrayOneOf(
			this.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);

		try {
			const identityConnector = this.getConnectorByUri(identity);

			const verificationMethod = await identityConnector.addVerificationMethod(
				controller,
				identity,
				verificationMethodType,
				verificationMethodId
			);

			return verificationMethod;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verificationMethodCreateFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async verificationMethodRemove(
		verificationMethodId: string,
		controller?: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeVerificationMethod(controller, verificationMethodId);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verificationMethodRemoveFailed",
				{ verificationMethodId },
				error
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param identity The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceCreate(
		identity: string,
		serviceId: string,
		serviceType: string | string[],
		serviceEndpoint: string | string[],
		controller?: string
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		if (Is.array(serviceType)) {
			Guards.arrayValue<string>(this.CLASS_NAME, nameof(serviceType), serviceType);
		} else {
			Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		}
		if (Is.array(serviceEndpoint)) {
			Guards.arrayValue<string>(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		} else {
			Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		}

		try {
			const identityConnector = this.getConnectorByUri(identity);

			const service = await identityConnector.addService(
				controller,
				identity,
				serviceId,
				serviceType,
				serviceEndpoint
			);

			return service;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"serviceCreateFailed",
				{ identity, serviceId },
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @param controller The controller of the identity who can make changes.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(serviceId: string, controller?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const idParts = DocumentHelper.parseId(serviceId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeService(controller, serviceId);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "serviceRemoveFailed", { serviceId }, error);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param id The id of the credential.
	 * @param subject The credential subject to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiableCredentialCreate(
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		revocationIndex?: number,
		controller?: string
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.objectValue(this.CLASS_NAME, nameof(subject), subject);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const service = await identityConnector.createVerifiableCredential(
				controller,
				verificationMethodId,
				id,
				subject,
				revocationIndex
			);

			return service;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifiableCredentialCreateFailed",
				{ verificationMethodId },
				error
			);
		}
	}

	/**
	 * Verify a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async verifiableCredentialVerify(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(credentialJwt), credentialJwt);

		const jwtDecoded = await Jwt.decode(credentialJwt);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (
			Is.undefined(jwtHeader) ||
			Is.undefined(jwtPayload) ||
			Is.undefined(jwtPayload.iss) ||
			Is.undefined(jwtSignature)
		) {
			throw new GeneralError(this.CLASS_NAME, "jwtDecodeFailed");
		}

		try {
			const identityConnector = this.getConnectorByUri(jwtPayload.iss);

			const service = await identityConnector.checkVerifiableCredential(credentialJwt);

			return service;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "verifiableCredentialVerifyFailed", undefined, error);
		}
	}

	/**
	 * Revoke verifiable credential.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index revoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns Nothing.
	 */
	public async verifiableCredentialRevoke(
		issuerIdentity: string,
		credentialIndex: number,
		controller?: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerIdentity), issuerIdentity);
		Guards.number(this.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		try {
			const idParts = DocumentHelper.parseId(issuerIdentity);

			const identityConnector = this.getConnectorByUri(idParts.id);

			return identityConnector.revokeVerifiableCredentials(controller, issuerIdentity, [
				credentialIndex
			]);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifiableCredentialRevokeFailed",
				{ issuerIdentity, credentialIndex },
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns Nothing.
	 */
	public async verifiableCredentialUnrevoke(
		issuerIdentity: string,
		credentialIndex: number,
		controller?: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerIdentity), issuerIdentity);
		Guards.number(this.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		try {
			const idParts = DocumentHelper.parseId(issuerIdentity);

			const identityConnector = this.getConnectorByUri(idParts.id);

			return identityConnector.unrevokeVerifiableCredentials(controller, issuerIdentity, [
				credentialIndex
			]);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifiableCredentialUnrevokeFailed",
				{ issuerIdentity, credentialIndex },
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param verificationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiablePresentationCreate(
		verificationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential)[],
		expiresInMinutes?: number,
		controller?: string
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			return identityConnector.createVerifiablePresentation(
				controller,
				verificationMethodId,
				presentationId,
				contexts,
				types,
				verifiableCredentials,
				expiresInMinutes
			);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifiablePresentationCreateFailed",
				{ verificationMethodId },
				error
			);
		}
	}

	/**
	 * Verify a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async verifiablePresentationVerify(presentationJwt: string): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(presentationJwt), presentationJwt);

		const jwtDecoded = await Jwt.decode(presentationJwt);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (
			Is.undefined(jwtHeader) ||
			Is.undefined(jwtPayload) ||
			Is.undefined(jwtPayload.iss) ||
			Is.undefined(jwtSignature)
		) {
			throw new GeneralError(this.CLASS_NAME, "jwtDecodeFailed");
		}

		try {
			const identityConnector = this.getConnectorByUri(jwtPayload.iss);

			const service = await identityConnector.checkVerifiablePresentation(presentationJwt);

			return service;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"verifiablePresentationVerifyFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for a document with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The proof.
	 */
	public async proofCreate(
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject,
		controller?: string
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

			const identityConnector = this.getConnectorByUri(idParts.id);

			return identityConnector.createProof(
				controller,
				verificationMethodId,
				proofType,
				unsecureDocument
			);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "proofCreateFailed", { verificationMethodId }, error);
		}
	}

	/**
	 * Verify proof for a document with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(document: IJsonLdNodeObject, proof: IProof): Promise<boolean> {
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(document), document);
		Guards.object<IProof>(this.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.verificationMethod), proof.verificationMethod);

		try {
			const idParts = DocumentHelper.parseId(proof.verificationMethod);

			const identityConnector = this.getConnectorByUri(idParts.id);

			return identityConnector.verifyProof(document, proof);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "proofVerifyFailed", undefined, error);
		}
	}

	/**
	 * Get the connector from the namespace.
	 * @param namespace The namespace for the identity.
	 * @returns The connector.
	 * @internal
	 */
	private getConnectorByNamespace(namespace?: string): IIdentityConnector {
		const namespaceMethod = namespace ?? this._defaultNamespace;

		const connector = IdentityConnectorFactory.getIfExists<IIdentityConnector>(namespaceMethod);

		if (Is.empty(connector)) {
			throw new GeneralError(this.CLASS_NAME, "connectorNotFound", { namespace: namespaceMethod });
		}

		return connector;
	}

	/**
	 * Get the connector from the uri.
	 * @param id The id of the identity in urn format.
	 * @returns The connector.
	 * @internal
	 */
	private getConnectorByUri(id: string): IIdentityConnector {
		const idUri = Urn.fromValidString(id);

		if (idUri.namespaceIdentifier() !== "did") {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: "did",
				id
			});
		}

		return this.getConnectorByNamespace(idUri.namespaceMethod());
	}
}

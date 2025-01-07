// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is, NotImplementedError, Urn } from "@twin.org/core";
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
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidProof,
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
	 * The namespace supported by the identity service.
	 */
	public static readonly NAMESPACE: string = "did";

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
	 * @param controller The controller of the identity who can make changes.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity document.
	 */
	public async identityCreate(controller: string, namespace?: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const identityConnector = this.getConnectorByNamespace(namespace);
			return identityConnector.createDocument(controller);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "identityCreateFailed", undefined, error);
		}
	}

	/**
	 * Resolve an identity.
	 * @param identity The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async identityResolve(identity: string): Promise<IDidDocument> {
		Urn.guard(this.CLASS_NAME, nameof(identity), identity);

		try {
			const identityConnector = this.getConnectorByUri(identity);

			const document = await identityConnector.resolveDocument(identity);

			return document;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"identityResolveFailed",
				{
					identity
				},
				error
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param controller The controller of the identity who can make changes.
	 * @param identity The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async verificationMethodCreate(
		controller: string,
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
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
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async verificationMethodRemove(
		controller: string,
		verificationMethodId: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);

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
	 * @param controller The controller of the identity who can make changes.
	 * @param identity The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceCreate(
		controller: string,
		identity: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

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
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(controller: string, serviceId: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Urn.guard(this.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const idParts = DocumentHelper.parse(serviceId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeService(controller, serviceId);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "serviceRemoveFailed", { serviceId }, error);
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
	public async verifiableCredentialCreate(
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
		Urn.guard(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.objectValue(this.CLASS_NAME, nameof(credential), credential);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const service = await identityConnector.createVerifiableCredential(
				controller,
				verificationMethodId,
				id,
				credential,
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
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialRevoke(
		controller: string,
		issuerIdentity: string,
		credentialIndex: number
	): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialUnrevoke(
		controller: string,
		issuerIdentity: string,
		credentialIndex: number
	): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
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
	public async verifiablePresentationCreate(
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
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
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
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof.
	 */
	public async proofCreate(
		controller: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<IDidProof> {
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(bytes: Uint8Array, proof: IDidProof): Promise<boolean> {
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
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

		if (idUri.namespaceIdentifier() !== IdentityService.NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: IdentityService.NAMESPACE,
				id
			});
		}

		return this.getConnectorByNamespace(idUri.namespaceMethod());
	}
}

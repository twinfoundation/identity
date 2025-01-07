// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import type { IBaseRestClientConfig } from "@twin.org/api-models";
import { NotImplementedError, Urn } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type {
	IIdentityComponent,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@twin.org/identity-models";
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

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityClient extends BaseRestClient implements IIdentityComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityClient>(), config, "identity");
	}

	/**
	 * Create a new identity.
	 * @param controller The controller of the identity who can make changes.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity document.
	 */
	public async identityCreate(controller: string, namespace?: string): Promise<IDidDocument> {
		throw new NotImplementedError(this.CLASS_NAME, "identityCreate");
	}

	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async identityResolve(documentId: string): Promise<IDidDocument> {
		Urn.guard(this.CLASS_NAME, nameof(documentId), documentId);

		const response = await this.fetch<IIdentityResolveRequest, IIdentityResolveResponse>(
			"/:id",
			"GET",
			{
				pathParams: {
					id: documentId
				}
			}
		);

		return response.body;
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
		throw new NotImplementedError(this.CLASS_NAME, "verificationMethodCreate");
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
		throw new NotImplementedError(this.CLASS_NAME, "verificationMethodRemove");
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
		throw new NotImplementedError(this.CLASS_NAME, "serviceCreate");
	}

	/**
	 * Remove a service from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(controller: string, serviceId: string): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "serviceRemove");
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
		throw new NotImplementedError(this.CLASS_NAME, "verifiableCredentialCreate");
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
		throw new NotImplementedError(this.CLASS_NAME, "verifiableCredentialVerify");
	}

	/**
	 * Revoke verifiable credential.
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialRevoke(
		controller: string,
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "verifiableCredentialRevoke");
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialUnrevoke(
		controller: string,
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		throw new NotImplementedError(this.CLASS_NAME, "verifiableCredentialUnrevoke");
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
		throw new NotImplementedError(this.CLASS_NAME, "verifiablePresentationCreate");
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
		throw new NotImplementedError(this.CLASS_NAME, "verifiablePresentationVerify");
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
		throw new NotImplementedError(this.CLASS_NAME, "proofCreate");
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(bytes: Uint8Array, proof: IDidProof): Promise<boolean> {
		throw new NotImplementedError(this.CLASS_NAME, "proofVerify");
	}
}

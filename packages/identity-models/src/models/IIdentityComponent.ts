// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
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
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentityComponent extends IComponent {
	/**
	 * Create a new identity.
	 * @param controller The controller of the identity who can make changes.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity document.
	 */
	identityCreate(controller: string, namespace?: string): Promise<IDidDocument>;

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
	verificationMethodCreate(
		controller: string,
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod>;

	/**
	 * Remove a verification method from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	verificationMethodRemove(controller: string, verificationMethodId: string): Promise<void>;

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
	serviceCreate(
		controller: string,
		identity: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService>;

	/**
	 * Remove a service from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	serviceRemove(controller: string, serviceId: string): Promise<void>;

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
	verifiableCredentialCreate(
		controller: string,
		verificationMethodId: string,
		id: string | undefined,
		credential: IJsonLdNodeObject,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}>;

	/**
	 * Verify a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	verifiableCredentialVerify(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}>;

	/**
	 * Revoke verifiable credential.
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index revoke.
	 * @returns Nothing.
	 */
	verifiableCredentialRevoke(
		controller: string,
		issuerId: string,
		credentialIndex: number
	): Promise<void>;

	/**
	 * Unrevoke verifiable credential.
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @returns Nothing.
	 */
	verifiableCredentialUnrevoke(
		controller: string,
		issuerId: string,
		credentialIndex: number
	): Promise<void>;

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
	verifiablePresentationCreate(
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
	}>;

	/**
	 * Verify a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	verifiablePresentationVerify(presentationJwt: string): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}>;

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof.
	 */
	proofCreate(
		controller: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<IDidProof>;

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	proofVerify(bytes: Uint8Array, proof: IDidProof): Promise<boolean>;
}

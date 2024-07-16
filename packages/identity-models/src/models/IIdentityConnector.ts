// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IServiceRequestContext, IService } from "@gtsc/services";
import type {
	DidVerificationMethodType,
	IDidDocument,
	IDidDocumentVerificationMethod,
	IDidService,
	IDidVerifiableCredential,
	IDidVerifiablePresentation
} from "@gtsc/standards-w3c-did";

/**
 * Interface describing an identity connector.
 */
export interface IIdentityConnector extends IService {
	/**
	 * Create a new document.
	 * @param controller The controller address for the document.
	 * @param requestContext The context for the request.
	 * @returns The created document.
	 */
	createDocument(
		controller: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocument>;

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @param requestContext The context for the request.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	resolveDocument(
		documentId: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocument>;

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @param requestContext The context for the request.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	addVerificationMethod(
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocumentVerificationMethod>;

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	removeVerificationMethod(
		verificationMethodId: string,
		requestContext?: IServiceRequestContext
	): Promise<void>;

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @param requestContext The context for the request.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	addService(
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidService>;

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	removeService(serviceId: string, requestContext?: IServiceRequestContext): Promise<void>;

	/**
	 * Create a verifiable credential for a verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param types The type for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param contexts Additional contexts to include in the credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @param requestContext The context for the request.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiableCredential<T>(
		verificationMethodId: string,
		credentialId: string | undefined,
		types: string | string[] | undefined,
		subject: T | T[],
		contexts?: string | string[],
		revocationIndex?: number,
		requestContext?: IServiceRequestContext
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}>;

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @param requestContext The context for the request.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	checkVerifiableCredential<T>(
		credentialJwt: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}>;

	/**
	 * Revoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	revokeVerifiableCredentials(
		issuerDocumentId: string,
		credentialIndices: number[],
		requestContext?: IServiceRequestContext
	): Promise<void>;

	/**
	 * Unrevoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	unrevokeVerifiableCredentials(
		issuerDocumentId: string,
		credentialIndices: number[],
		requestContext?: IServiceRequestContext
	): Promise<void>;

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param contexts Additional contexts to include in the presentation.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @param requestContext The context for the request.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiablePresentation(
		presentationMethodId: string,
		types: string | string[] | undefined,
		verifiableCredentials: string[],
		contexts?: string | string[],
		expiresInMinutes?: number,
		requestContext?: IServiceRequestContext
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}>;

	/**
	 * Check a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @param requestContext The context for the request.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	checkVerifiablePresentation(
		presentationJwt: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}>;

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @param requestContext The context for the request.
	 * @returns The proof signature type and value.
	 */
	createProof(
		verificationMethodId: string,
		bytes: Uint8Array,
		requestContext?: IServiceRequestContext
	): Promise<{
		type: string;
		value: Uint8Array;
	}>;

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @param requestContext The context for the request.
	 * @returns True if the signature is valid.
	 */
	verifyProof(
		verificationMethodId: string,
		bytes: Uint8Array,
		signatureType: string,
		signatureValue: Uint8Array,
		requestContext?: IServiceRequestContext
	): Promise<boolean>;
}

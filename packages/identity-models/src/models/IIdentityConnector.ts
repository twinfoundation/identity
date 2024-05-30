// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRequestContext, IService } from "@gtsc/services";
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
	 * @param requestContext The context for the request.
	 * @returns The created document.
	 */
	createDocument(requestContext: IRequestContext): Promise<IDidDocument>;

	/**
	 * Resolve a document from its id.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	resolveDocument(requestContext: IRequestContext, documentId: string): Promise<IDidDocument>;

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
	addVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod>;

	/**
	 * Remove a verification method from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	removeVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string
	): Promise<void>;

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
	addService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService>;

	/**
	 * Remove a service from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the service from.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	removeService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string
	): Promise<void>;

	/**
	 * Create a verifiable credential for a verification method.
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		verificationMethodId: string,
		credentialId: string,
		schemaTypes: string | string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}>;

	/**
	 * Check a verifiable credential is valid.
	 * @param requestContext The context for the request.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	checkVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		credentialJwt: string
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}>;

	/**
	 * Revoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	revokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void>;

	/**
	 * Unrevoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	unrevokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void>;

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param requestContext The context for the request.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiablePresentation(
		requestContext: IRequestContext,
		holderDocumentId: string,
		presentationMethodId: string,
		schemaTypes: string | string[],
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}>;

	/**
	 * Check a verifiable presentation is valid.
	 * @param requestContext The context for the request.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	checkVerifiablePresentation(
		requestContext: IRequestContext,
		presentationJwt: string
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}>;

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	createProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
	}>;

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	verifyProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: Uint8Array,
		signatureType: string,
		signatureValue: Uint8Array
	): Promise<boolean>;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IService } from "@gtsc/services";
import type { IDidDocument } from "./did/IDidDocument";
import type { IDidVerifiableCredential } from "./did/IDidVerifiableCredential";
import type { IDidVerifiablePresentation } from "./did/IDidVerifiablePresentation";

/**
 * Interface describing an identity provider.
 */
export interface IIdentityProvider extends IService {
	/**
	 * Create a new document from the key pair.
	 * @param documentPrivateKey The private key to use in generating the document.
	 * @param documentPublicKey The public key to use in generating the document.
	 * @returns The created document.
	 */
	createDocument(
		documentPrivateKey: Uint8Array,
		documentPublicKey: Uint8Array
	): Promise<IDidDocument>;

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	resolveDocument(documentId: string): Promise<IDidDocument>;

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param documentId The id of the document to add the verification method to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param verificationPublicKey The public key for the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	addVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationPublicKey: Uint8Array
	): Promise<IDidDocument>;

	/**
	 * Remove a verification method from the document.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param verificationMethodId The id of the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	removeVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationMethodId: string
	): Promise<IDidDocument>;

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	addService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidDocument>;

	/**
	 * Remove a service from the document.
	 * @param documentId The id of the document to remove the service from.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	removeService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string
	): Promise<IDidDocument>;

	/**
	 * Create a verifiable credential for a verification method.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param assertionMethodId The assertion method id to use.
	 * @param assertionMethodPrivateKey The private key required to generate the verifiable credential.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiableCredential<T extends { id?: string }>(
		issuerDocumentId: string,
		assertionMethodId: string,
		assertionMethodPrivateKey: Uint8Array,
		credentialId: string,
		schemaTypes: string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}>;

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	checkVerifiableCredential<T extends { id?: string }>(
		credentialJwt: string
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}>;

	/**
	 * Revoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	revokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument>;

	/**
	 * Unrevoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	unrevokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument>;

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param presentationPrivateKey The private key required to generate the verifiable presentation.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiablePresentation(
		holderDocumentId: string,
		presentationMethodId: string,
		presentationPrivateKey: Uint8Array,
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}>;

	/**
	 * Check a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	checkVerifiablePresentation(presentationJwt: string): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}>;

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param verificationPrivateKey The private key required to generate the proof.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	createProof(
		documentId: string,
		verificationMethodId: string,
		verificationPrivateKey: Uint8Array,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
	}>;

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @param bytes The data bytes to verify.
	 * @returns True if the signature is valid.
	 */
	verifyProof(
		documentId: string,
		verificationMethodId: string,
		signatureType: string,
		signatureValue: Uint8Array,
		bytes: Uint8Array
	): Promise<boolean>;
}

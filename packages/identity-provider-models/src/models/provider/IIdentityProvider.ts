// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IService } from "@gtsc/services";
import type { IDidCredentialVerification } from "./IDidCredentialVerification";
import type { IDidDocument } from "./IDidDocument";
import type { IDidPresentationVerification } from "./IDidPresentationVerification";
import type { IDidVerifiableCredential } from "./IDidVerifiableCredential";
import type { IDidVerifiablePresentation } from "./IDidVerifiablePresentation";
import type { IKeyPair } from "../IKeyPair";

/**
 * Interface describing an identity provider.
 */
export interface IIdentityProvider extends IService {
	/**
	 * Create a new document from the key pair.
	 * @param documentKeyPair The key pair to generate the document for.
	 * @returns The created document.
	 */
	createDocument(documentKeyPair: IKeyPair): Promise<IDidDocument>;

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
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param verificationPublicKey The public key for the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	addVerificationMethodJwk(
		documentId: string,
		documentKeyPair: IKeyPair,
		verificationPublicKey: string
	): Promise<IDidDocument>;

	/**
	 * Remove a verification method from the document.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param verificationMethodName The name of the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	removeVerificationMethod(
		documentId: string,
		documentKeyPair: IKeyPair,
		verificationMethodName: string
	): Promise<IDidDocument>;

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	addService(
		documentId: string,
		documentKeyPair: IKeyPair,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidDocument>;

	/**
	 * Remove a service from the document.
	 * @param documentId The id of the document to remove the service from.
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	removeService(
		documentId: string,
		documentKeyPair: IKeyPair,
		serviceId: string
	): Promise<IDidDocument>;

	/**
	 * Create a verifiable credential for a verification method.
	 * @param documentId The id of the document issuing the verifiable credential.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @param verificationMethod The verification method to use.
	 * @param verificationKeyPair The key required to generate the verifiable credential.
	 * @returns The created verifiable credential.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiableCredential<T extends { id?: string }>(
		documentId: string,
		credentialId: string,
		schemaTypes: string[],
		subject: T | T[],
		revocationIndex: string,
		verificationMethod: string,
		verificationKeyPair: IKeyPair
	): Promise<IDidVerifiableCredential<T>>;

	/**
	 * Check a verifiable credential is valid.
	 * @param credential The credential to verify.
	 * @returns Verification details for the credential.
	 */
	checkVerifiableCredential<T extends { id?: string }>(
		credential: IDidVerifiableCredential<T>
	): Promise<IDidCredentialVerification>;

	/**
	 * Revoke verifiable credential(s).
	 * @param documentId The id of the document to update the revocation list for.
	 * @param documentKeyPair The key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	revokeVerifiableCredentials(
		documentId: string,
		documentKeyPair: IKeyPair,
		credentialIndices: number[]
	): Promise<IDidDocument>;

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param documentId The id of the document creating the verifiable presentation.
	 * @param verifiableCredentials The credentials to use for creating the presentation.
	 * @param presentationMethod The method to associate with the presentation.
	 * @param presentationKeyPair The key required to generate the verifiable presentation.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The verifiable presentation.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	createVerifiablePresentation(
		documentId: string,
		verifiableCredentials: IDidVerifiableCredential<unknown> | IDidVerifiableCredential<unknown>[],
		presentationMethod: string,
		presentationKeyPair: IKeyPair,
		expiresInMinutes?: number
	): Promise<IDidVerifiablePresentation>;

	/**
	 * Verify a presentation.
	 * @param presentation The presentation to verify.
	 * @returns Verification details for the presentation.
	 */
	checkVerifiablePresentation(
		presentation: IDidVerifiablePresentation
	): Promise<IDidPresentationVerification>;

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document signing the data.
	 * @param bytes The data bytes to sign.
	 * @param verificationMethod The verification method to use.
	 * @param verificationKeyPair The key required to generate the proof.
	 * @returns The proof signature type and value.
	 */
	createProof(
		documentId: string,
		bytes: Uint8Array,
		verificationMethod: string,
		verificationKeyPair: IKeyPair
	): Promise<{
		type: string;
		value: string;
	}>;

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document verifying the data.
	 * @param bytes The data bytes to verify.
	 * @param verificationMethod The verification method to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	verifyProof(
		documentId: string,
		bytes: Uint8Array,
		verificationMethod: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean>;
}

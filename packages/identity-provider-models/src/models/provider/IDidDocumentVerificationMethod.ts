// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing a DID document verification method.
 */
export interface IDidDocumentVerificationMethod {
	/**
	 * The id of the entry.
	 */
	id: string;

	/**
	 * The controller for the entry.
	 */
	controller: string;

	/**
	 * The type of the entry.
	 */
	type: string;

	/**
	 * The public key for the entry.
	 * Spec https://datatracker.ietf.org/doc/html/draft-multiformats-multibase-03 .
	 */
	publicKeyMultibase?: string;

	/**
	 * The public key for the entry as a JWK.
	 * Spec https://datatracker.ietf.org/doc/html/rfc7517 .
	 */
	publicKeyJwk?: { [id: string]: string };

	/**
	 * Multi key partial revocation.
	 */
	revocation?: string;
}

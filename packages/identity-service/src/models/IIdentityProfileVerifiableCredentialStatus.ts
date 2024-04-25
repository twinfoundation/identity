// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface representing the status of a verifiable credential application.
 */
export interface IIdentityProfileVerifiableCredentialStatus {
	/**
	 * The type of the credential.
	 */
	type: string;

	/**
	 * The id of the credential.
	 */
	id: string;

	/**
	 * Which did issued the credential.
	 */
	issuer: string;
}

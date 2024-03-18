// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Get the verifiable credential application requirements.
 */
export interface IVerifiableCredentialRequirementsGetRequest {
	/**
	 * The identity of the verifiable credential requirements.
	 */
	identity: string;

	/**
	 * The type of verifiable credential requirements being requested.
	 */
	verifiableCredentialType: string;
}

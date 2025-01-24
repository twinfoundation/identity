// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to verify a verifiable credential.
 */
export interface IIdentityVerifiableCredentialVerifyRequest {
	/**
	 * The path parameters.
	 */
	query: {
		/**
		 * The jwt to verify.
		 */
		jwt: string;
	};
}

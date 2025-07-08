// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to verify a verifiable presentation.
 */
export interface IIdentityVerifiablePresentationVerifyRequest {
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

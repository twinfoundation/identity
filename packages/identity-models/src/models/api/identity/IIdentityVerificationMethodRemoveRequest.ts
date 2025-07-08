// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to remove a verification method.
 */
export interface IIdentityVerificationMethodRemoveRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to remove the verification method from.
		 */
		identity: string;

		/**
		 * The verification method to remove.
		 */
		verificationMethodId: string;
	};
}

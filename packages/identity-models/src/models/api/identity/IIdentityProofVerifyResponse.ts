// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to verifying a proof.
 */
export interface IIdentityProofVerifyResponse {
	/**
	 * The response payload.
	 */
	body: {
		verified: boolean;
	};
}

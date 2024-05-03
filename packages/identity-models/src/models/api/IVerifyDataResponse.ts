// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The response to a data verification request.
 */
export interface IVerifyDataResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * Is the signature verified.
		 */
		verified: boolean;
	};
}

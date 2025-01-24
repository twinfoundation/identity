// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to create an identity.
 */
export interface IIdentityCreateRequest {
	/**
	 * The data for the request.
	 */
	body?: {
		/**
		 * The optional namespace to create the identity in.
		 */
		namespace?: string;
	};
}

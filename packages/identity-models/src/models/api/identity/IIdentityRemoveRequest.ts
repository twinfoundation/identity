// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to remove an identity.
 */
export interface IIdentityRemoveRequest {
	/**
	 * The data for the request.
	 */
	pathParams: {
		/**
		 * The identity to remove.
		 */
		identity: string;
	};
}

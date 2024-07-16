// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Create a new identity.
 */
export interface IIdentityCreateRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The controller for the identity.
		 */
		controller: string;
	};
}

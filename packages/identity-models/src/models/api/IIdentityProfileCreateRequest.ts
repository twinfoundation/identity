// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to create an identity profile.
 */
export interface IIdentityProfileCreateRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The public profile data.
		 */
		publicProfile?: unknown;

		/**
		 * The private profile data.
		 */
		privateProfile?: unknown;
	};
}

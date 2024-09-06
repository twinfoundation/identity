// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to update an identity profile.
 */
export interface IIdentityProfileUpdateRequest {
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

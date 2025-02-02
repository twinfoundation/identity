// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Get the profile for an identity.
 */
export interface IIdentityProfileGetRequest {
	/**
	 * The query parameters.
	 */
	query?: {
		/**
		 * The public properties to get for the profile, defaults to all, should be a comma separated list.
		 */
		publicPropertyNames?: string;

		/**
		 * The private properties to get for the profile, defaults to all, should be a comma separated list.
		 */
		privatePropertyNames?: string;
	};
}

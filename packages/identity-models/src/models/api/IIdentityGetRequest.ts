// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Get the profile for an identity.
 */
export interface IIdentityGetRequest {
	/**
	 * The path parameters.
	 */
	path: {
		/**
		 * The identity to get the profile for.
		 */
		identity: string;
	};

	/**
	 * The query parameters.
	 */
	query: {
		/**
		 * The properties to get for the profile, defaults to all.
		 * should be a comma separated list.
		 */
		propertyNames?: string;
	};
}

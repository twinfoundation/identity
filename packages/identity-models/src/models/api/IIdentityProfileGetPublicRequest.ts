// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Get the public profile for an identity.
 */
export interface IIdentityProfileGetPublicRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
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
		 * The properties to get for the profile, defaults to all, should be a comma separated list.
		 */
		propertyNames?: string;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to get a list of identities by role.
 */
export interface IIdentityListRequest {
	/**
	 * The query parameters.
	 */
	query: {
		/**
		 * The property name to use for lookup.
		 */
		propertyName: string;

		/**
		 * The property value to use for lookup.
		 */
		propertyValue: string;

		/**
		 * The properties to get for the profile, defaults to all.
		 */
		propertyNames?: string[];

		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;

		/**
		 * Number of items to return.
		 */
		pageSize?: number;
	};
}

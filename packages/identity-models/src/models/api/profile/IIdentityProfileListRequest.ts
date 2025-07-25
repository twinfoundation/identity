// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to get a list of identities.
 */
export interface IIdentityProfileListRequest {
	/**
	 * The query parameters.
	 */
	query?: {
		/**
		 * The public filters to apply to the list, comma separated list with color between key and value for each pair e.g. prop1:value1,prop2:value2.
		 */
		publicFilters?: string;

		/**
		 * The public properties to get for the profile, defaults to all, should be a comma separated list.
		 */
		publicPropertyNames?: string;

		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;

		/**
		 * Number of items to return.
		 */
		pageSize?: number | string;
	};
}

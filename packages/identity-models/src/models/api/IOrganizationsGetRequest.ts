// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to get a list of organizations.
 */
export interface IOrganizationsGetRequest {
	/**
	 * The query parameters.
	 */
	query: {
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

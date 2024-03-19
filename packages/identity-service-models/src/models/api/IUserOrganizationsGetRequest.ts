// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to get a list of organization users.
 */
export interface IUserOrganizationsGetRequest {
	/**
	 * The identity of the organization.
	 */
	identity: string;

	/**
	 * The query parameters.
	 */
	query: {
		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;
	};
}

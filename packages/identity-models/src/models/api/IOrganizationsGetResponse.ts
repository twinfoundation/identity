// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to get a list of organizations.
 */
export interface IOrganizationsGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;

		/**
		 * The organizations.
		 */
		organizations: {
			identity: string;
			name: string;
		}[];
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to get a list of organization users.
 */
export interface IUserOrganizationsGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The cursor for paged requests.
		 */
		nextPageCursor?: string;

		/**
		 * Organization users.
		 */
		users: {
			/**
			 * The user email.
			 */
			email: string;

			/**
			 * The user name.
			 */
			name: string;
		}[];
	};
}

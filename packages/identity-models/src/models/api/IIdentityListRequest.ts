// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IdentityRole } from "../identityRole";

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
		role: IdentityRole;

		/**
		 * The properties to get for the profile, defaults to all.
		 * should be a comma separated list.
		 */
		propertyNames?: string;

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

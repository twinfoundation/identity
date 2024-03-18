// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to get an organization.
 */
export interface IOrganizationGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The name of the organization.
		 */
		name: string;
	};
}

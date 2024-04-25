// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";

/**
 * Response to get a list of identities.
 */
export interface IIdentityListResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;

		/**
		 * The identities.
		 */
		identities: { [id: string]: IProperty[] }[];
	};
}

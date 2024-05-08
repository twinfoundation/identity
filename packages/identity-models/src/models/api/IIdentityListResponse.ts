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
		 * The identities.
		 */
		identities: {
			identity: string;
			properties?: IProperty[];
		}[];

		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;

		/**
		 * Number of entities to return.
		 */
		pageSize?: number;

		/**
		 * Total entities length.
		 */
		totalEntities: number;
	};
}

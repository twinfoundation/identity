// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityProfileProperty } from "../IIdentityProfileProperty";

/**
 * Response to get a list of identities.
 */
export interface IIdentityProfileListResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The identities.
		 */
		identities: {
			/**
			 * The identity.
			 */
			identity: string;

			/**
			 * The properties for the identity.
			 */
			properties?: IIdentityProfileProperty[];
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

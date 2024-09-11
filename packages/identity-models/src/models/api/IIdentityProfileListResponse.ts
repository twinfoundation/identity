// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@gtsc/data-json-ld";

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
		items: {
			/**
			 * The identity.
			 */
			identity: string;

			/**
			 * The public profile data.
			 */
			publicProfile?: Partial<IJsonLdDocument>;
		}[];

		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	};
}

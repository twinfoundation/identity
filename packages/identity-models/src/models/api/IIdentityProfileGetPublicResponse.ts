// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";

/**
 * Response to get an identity public profile.
 */
export interface IIdentityProfileGetPublicResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The properties for the identity.
		 */
		properties?: IProperty[];
	};
}

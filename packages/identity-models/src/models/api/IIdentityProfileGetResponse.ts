// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityProfileProperty } from "../IIdentityProfileProperty";

/**
 * Response to get an identity details.
 */
export interface IIdentityProfileGetResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The properties for the identity.
		 */
		properties?: IIdentityProfileProperty[];
	};
}

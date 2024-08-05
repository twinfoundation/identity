// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityProfileProperty } from "../IIdentityProfileProperty";

/**
 * Request to create an identity profile.
 */
export interface IIdentityProfileCreateRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * Properties for the identity.
		 */
		properties: IIdentityProfileProperty[];
	};
}

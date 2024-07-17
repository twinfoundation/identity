// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityProfileProperty } from "../IIdentityProfileProperty";

/**
 * Request to update an identity profile.
 */
export interface IIdentityProfileUpdateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to update the profile for.
		 */
		identity: string;
	};

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

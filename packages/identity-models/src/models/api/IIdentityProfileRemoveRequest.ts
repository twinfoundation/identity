// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Remove the profile for an identity.
 */
export interface IIdentityProfileRemoveRequest {
	/**
	 * The path parameters.
	 */
	pathParams?: {
		/**
		 * The identity to remove the profile for.
		 */
		identity: string;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to get an identity details.
 */
export interface IIdentityProfileGetResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The identity of the profile, this is the authenticated user identity.
		 */
		identity: string;

		/**
		 * The public profile data.
		 */
		publicProfile?: unknown;

		/**
		 * The private profile data.
		 */
		privateProfile?: unknown;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@twin.org/data-json-ld";

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
		publicProfile?: Partial<IJsonLdDocument>;

		/**
		 * The private profile data.
		 */
		privateProfile?: Partial<IJsonLdDocument>;
	};
}

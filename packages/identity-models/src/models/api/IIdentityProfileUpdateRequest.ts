// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@gtsc/data-json-ld";

/**
 * Request to update an identity profile.
 */
export interface IIdentityProfileUpdateRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The public profile data.
		 */
		publicProfile?: IJsonLdDocument;

		/**
		 * The private profile data.
		 */
		privateProfile?: IJsonLdDocument;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@twin.org/data-json-ld";
import type { HeaderTypes, MimeTypes } from "@twin.org/web";

/**
 * Response to get an identity public profile.
 */
export interface IIdentityProfileGetPublicResponse {
	/**
	 * The response headers.
	 */
	headers: {
		[HeaderTypes.ContentType]: typeof MimeTypes.JsonLd;
	};

	/**
	 * The response payload.
	 */
	body: Partial<IJsonLdDocument>;
}

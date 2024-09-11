// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@gtsc/data-json-ld";
import type { HeaderTypes, MimeTypes } from "@gtsc/web";

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

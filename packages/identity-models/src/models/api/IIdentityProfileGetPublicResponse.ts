// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { MimeTypes } from "@gtsc/web";

/**
 * Response to get an identity public profile.
 */
export interface IIdentityProfileGetPublicResponse {
	/**
	 * The response headers.
	 */
	headers: {
		["Content-Type"]: typeof MimeTypes.JsonLd;
	};

	/**
	 * The response payload.
	 */
	body: unknown;
}

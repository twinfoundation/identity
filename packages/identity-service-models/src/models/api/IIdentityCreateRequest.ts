// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";

/**
 * Create a new identity.
 */
export interface IIdentityCreateRequest {
	/**
	 * The data for the request.
	 */
	data: {
		/**
		 * Optional fields.
		 */
		properties?: IProperty[];
	};
}

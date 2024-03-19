// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";

/**
 * Update an identity.
 */
export interface IIdentityUpdateRequest {
	/**
	 * The identity to update.
	 */
	identity: string;

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

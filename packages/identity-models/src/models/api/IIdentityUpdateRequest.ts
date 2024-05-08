// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";

/**
 * Request to update an identity.
 */
export interface IIdentityUpdateRequest {
	/**
	 * The identity to update the properties.
	 */
	identity: string;

	/**
	 * The data for the request.
	 */
	data: {
		/**
		 * Properties for the identity.
		 */
		properties: IProperty[];
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";

/**
 * Request to update an identity.
 */
export interface IIdentityUpdateRequest {
	/**
	 * The path parameters.
	 */
	path: {
		/**
		 * The identity to update the profile for.
		 */
		identity: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * Properties for the identity.
		 */
		properties: IProperty[];
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";
import type { IdentityRole } from "../identityRole";

/**
 * Response to get an identity details.
 */
export interface IIdentityGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The role of the identity.
		 */
		role: IdentityRole;

		/**
		 * The properties for the identity.
		 */
		properties?: IProperty[];
	};
}

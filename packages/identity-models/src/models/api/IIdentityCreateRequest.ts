// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";
import type { IdentityRole } from "../identityRole";

/**
 * Create a new identity.
 */
export interface IIdentityCreateRequest {
	/**
	 * The data for the request.
	 */
	data: {
		/**
		 * The role for the identity.
		 */
		role: IdentityRole;

		/**
		 * Initial properties for the identity.
		 */
		properties?: IProperty[];
	};
}

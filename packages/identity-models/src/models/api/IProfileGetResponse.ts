// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";
import type { IdentityRole } from "../service/identityRole";

/**
 * Response to get a profile.
 */
export interface IProfileGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The role in the profile.
		 */
		role: IdentityRole;

		/**
		 * The email address for the identity.
		 */
		emailAddress: string;

		/**
		 * The name in the profile.
		 */
		name?: string;

		/**
		 * The image in the profile.
		 */
		imageBase64?: string;

		/**
		 * Additional properties for the profile.
		 */
		properties?: IProperty[];
	};
}

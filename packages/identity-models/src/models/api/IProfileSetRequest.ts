// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";

/**
 * Request to update a profile.
 */
export interface IProfileSetRequest {
	/**
	 * The identity to update the profile.
	 */
	identity: string;

	/**
	 * The data for the request.
	 */
	data: {
		/**
		 * The email address for the identity.
		 */
		emailAddress: string;

		/**
		 * The image to update the profile with.
		 */
		imageBase64?: string;

		/**
		 * Additional properties for the profile.
		 */
		properties?: IProperty[];
	};
}

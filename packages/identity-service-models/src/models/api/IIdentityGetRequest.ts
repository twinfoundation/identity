// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Get the profile for an identity.
 */
export interface IIdentityGetRequest {
	/**
	 * The identity to get the profile for.
	 */
	identity: string;

	/**
	 * The properties to get for the profile, defaults to all.
	 */
	propertyNames?: string[];
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Definitions for verifiable credential claim requirement.
 */
export interface IIdentityClaimRequirement {
	/**
	 * The property key for the verifiable credential claim requirement.
	 */
	key: string;

	/**
	 * The data type for the verifiable credential claim requirement.
	 */
	type: string;

	/**
	 * Should this property be available in public presentation of the claims.
	 */
	isPublic: boolean;
}

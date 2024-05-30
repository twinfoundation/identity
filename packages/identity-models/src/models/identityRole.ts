// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The roles that an identity can have.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityRole = {
	/**
	 * Node.
	 */
	Node: "node",

	/**
	 * Organization.
	 */
	Organization: "organization",

	/**
	 * User.
	 */
	User: "user"
} as const;

/**
 * The roles that an identity can have.
 */
export type IdentityRole = (typeof IdentityRole)[keyof typeof IdentityRole];

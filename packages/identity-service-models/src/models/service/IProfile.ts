// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";
import type { IdentityRole } from "./identityRole";

/**
 * Details of an identity.
 */
export interface IProfile {
	/**
	 * The role for the identity.
	 */
	role: IdentityRole;

	/**
	 * The email address for the identity.
	 */
	emailAddress: string;

	/**
	 * The name for the identity.
	 */
	name?: string;

	/**
	 * The binary data for the image.
	 */
	image?: Uint8Array;

	/**
	 * The properties for the profile.
	 */
	properties?: IProperty[];
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IdentityRole } from "@gtsc/identity-models";
import type { IProperty } from "@gtsc/schema";

/**
 * Interface representing profile details for the identity.
 */
export interface IIdentityProfile {
	/**
	 * The id for the identity.
	 */
	identity: string;

	/**
	 * The role for the identity.
	 */
	role: IdentityRole;

	/**
	 * The properties for the profile.
	 */
	properties?: IProperty[];
}

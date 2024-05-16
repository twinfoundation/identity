// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@gtsc/entity";
import type { IdentityRole } from "@gtsc/identity-models";
import type { IProperty } from "@gtsc/schema";

/**
 * Class representing profile details for the identity.
 */
@entity()
export class IdentityProfile {
	/**
	 * The id for the identity.
	 */
	@property({ type: "string", isPrimary: true })
	public identity!: string;

	/**
	 * The role for the identity.
	 */
	@property({ type: "string" })
	public role!: IdentityRole;

	/**
	 * The properties for the profile.
	 */
	@property({ type: "array", itemType: "object" })
	public properties?: IProperty[];
}

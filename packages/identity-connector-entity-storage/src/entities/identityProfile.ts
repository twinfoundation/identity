// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@gtsc/entity";
import type { IdentityProfileProperty } from "./identityProfileProperty";

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
	 * The properties for the profile.
	 */
	@property({ type: "object", itemTypeRef: "IdentityProfileProperty" })
	public properties?: {
		[key: string]: IdentityProfileProperty;
	};
}

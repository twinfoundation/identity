// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@gtsc/entity";

/**
 * Class representing profile details property for the identity.
 */
@entity()
export class IdentityProfileProperty {
	/**
	 * Is type of the item.
	 */
	@property({ type: "string" })
	public type!: string;

	/**
	 * The value for the item.
	 */
	@property({ type: "object" })
	public value!: unknown;

	/**
	 * Is the property public.
	 */
	@property({ type: "boolean" })
	public isPublic!: boolean;
}

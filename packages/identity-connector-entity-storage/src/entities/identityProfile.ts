// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@twin.org/entity";

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
	 * The public profile data.
	 */
	@property({ type: "object" })
	public publicProfile?: unknown;

	/**
	 * The private profile data.
	 */
	@property({ type: "object" })
	public privateProfile?: unknown;
}

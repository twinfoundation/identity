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

	/**
	 * Indexes for the current issuing keys.
	 */
	keyIndexes?: {
		[id: string]: {
			index: number;
			allocated: number;
		};
	};

	/**
	 * Issued verifiable credential ids.
	 */
	verifiableCredentials?: {
		/**
		 * The type of the credential.
		 */
		type: string;

		/**
		 * The id of the credential.
		 */
		id: string;

		/**
		 * Which did issuer the credential.
		 */
		issuer: string;
	}[];

	/**
	 * The next index to map to a verifiable credential id.
	 * Used for revocation of VCs.
	 */
	nextRevocationIndex?: string;
}

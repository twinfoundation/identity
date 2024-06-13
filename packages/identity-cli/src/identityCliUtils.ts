// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { Converter, Urn } from "@gtsc/core";
import { Bech32 } from "@gtsc/crypto";

/**
 * Utility functions for the identity CLI.
 */
export class IdentityCliUtils {
	/**
	 * Convert a DID to an address.
	 * @param did The DID to convert.
	 * @returns The address.
	 */
	public static didToAddress(did: string): string {
		// The did is made up from scheme:method:hrp:outputId
		const didUrn = Urn.fromValidString(did);
		const didParts = didUrn.parts(true);

		const bytes = Array.from(Converter.hexToBytes(didParts[3]));
		// An AliasAddress of 33 bytes is an AliasId of 32 bytes with the address kind field of 8 prepended.
		bytes.unshift(8);

		return Bech32.encode(didParts[2], new Uint8Array(bytes));
	}
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Urn } from "@gtsc/core";
import { Utils } from "@iota/sdk-wasm/node/lib/index.js";

/**
 * Utility functions for the iota identity.
 */
export class IotaIdentityUtils {
	/**
	 * Convert a DID to an address.
	 * @param did The DID to convert.
	 * @returns The address.
	 */
	public static didToAddress(did: string): string {
		// The did is made up from scheme:method:hrp:aliasId
		const didUrn = Urn.fromValidString(did);
		const didParts = didUrn.parts(true);
		return Utils.aliasIdToBech32(didParts[3], didParts[2]);
	}
}

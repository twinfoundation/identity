// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { KeyType } from "./keyType";

/**
 * Interface describing a key pair.
 */
export interface IKeyPair {
	/**
	 * The type of the key.
	 */
	type: KeyType;

	/**
	 * The public hex encoded version of the key.
	 */
	publicKey: string;

	/**
	 * The private hex encoded version of the key.
	 */
	privateKey: string;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Default package IDs for different networks.
 */
export const DEFAULT_IDENTITY_PKG_IDS: { [id: string]: string } = {
	/**
	 * Default package ID for testnet.
	 */
	testnet: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555",

	/**
	 * Default package ID for devnet.
	 */
	devnet: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"
} as const;

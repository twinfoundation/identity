// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import path from "node:path";
import { Bip39, Bip44, KeyType } from "@gtsc/crypto";
import type { IRequestContext } from "@gtsc/services";
import { MemoryVaultProvider } from "@gtsc/vault-provider-memory";
import * as dotenv from "dotenv";

dotenv.config({ path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")] });

if (!process.env.TEST_MNEMONIC) {
	// eslint-disable-next-line no-restricted-syntax
	throw new Error(
		`Please define TEST_MNEMONIC as a 24 word mnemonic either as an environment variable or inside an .env.dev file
		 e.g. TEST_MNEMONIC="word0 word1 ... word23"`
	);
}

export const TEST_TENANT_ID = "test-tenant";
export const TEST_MNEMONIC_ID = "test-mnemonic";

export const TEST_VAULT: MemoryVaultProvider = new MemoryVaultProvider({
	initialValues: {
		[TEST_TENANT_ID]: {
			[TEST_MNEMONIC_ID]: process.env.TEST_MNEMONIC ?? ""
		}
	}
});

const seed = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC ?? "");
const coinType = process.env.TEST_COIN_TYPE
	? Number.parseInt(process.env.TEST_COIN_TYPE, 10)
	: 999999;
const addressKeyPair = Bip44.addressBech32(seed, KeyType.Ed25519, "mem", coinType, 0, false, 0);
export const TEST_WALLET_KEY_PAIR = addressKeyPair.keyPair;
export const TEST_ADDRESS_BECH32 = addressKeyPair.address;
export const TEST_CONTEXT: IRequestContext = {
	tenantId: TEST_TENANT_ID
};

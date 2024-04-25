// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import path from "node:path";
import { Bip39, Bip44, KeyType } from "@gtsc/crypto";
import type { IRequestContext } from "@gtsc/services";
import { MemoryVaultProvider } from "@gtsc/vault-provider-memory";
import { IotaFaucetProvider, IotaWalletProvider } from "@gtsc/wallet-provider-iota";
import { CoinType, type IClientOptions } from "@iota/sdk-wasm/node";
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

export const TEST_CLIENT_OPTIONS: IClientOptions = {
	nodes: [process.env.TEST_NODE_ENDPOINT ?? ""],
	localPow: true
};
export const TEST_WALLET_PROVIDER = new IotaWalletProvider(
	{
		vaultProvider: TEST_VAULT,
		faucetProvider: new IotaFaucetProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			endpoint: process.env.TEST_FAUCET_ENDPOINT ?? ""
		})
	},
	{
		clientOptions: TEST_CLIENT_OPTIONS,
		walletMnemonicId: TEST_MNEMONIC_ID
	}
);
const seed = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC ?? "");
const coinType = process.env.TEST_COIN_TYPE
	? Number.parseInt(process.env.TEST_COIN_TYPE, 10)
	: CoinType.Shimmer;
const addressKeyPair = Bip44.addressBech32(
	seed,
	KeyType.Ed25519,
	process.env.TEST_BECH32_HRP ?? "",
	coinType,
	0,
	false,
	0
);
export const TEST_WALLET_KEY_PAIR = addressKeyPair.keyPair;
export const TEST_ADDRESS_BECH32 = addressKeyPair.address;
export const TEST_CONTEXT: IRequestContext = {
	tenantId: TEST_TENANT_ID
};

/**
 * Initialise the test wallet.
 */
export async function initTestWallet(): Promise<void> {
	console.log("Wallet Address", `${process.env.TEST_EXPLORER_ADDRESS}${TEST_ADDRESS_BECH32}`);
	await TEST_WALLET_PROVIDER.ensureBalance(TEST_CONTEXT, TEST_ADDRESS_BECH32, 1000000000n);
}

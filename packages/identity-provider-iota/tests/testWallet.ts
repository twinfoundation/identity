// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import path from "path";
import { KeyType, Bip39, Bip44 } from "@gtsc/crypto";
import { IotaFaucetProvider, IotaWalletProvider } from "@gtsc/wallet-provider-iota";
import { CoinType, type IClientOptions, type MnemonicSecretManager } from "@iota/sdk-wasm/node";
import * as dotenv from "dotenv";

const configFile = process.env.GITHUB_ACTIONS ? ".env.ci" : ".env";
console.log(`Using config file: ${configFile}`);
dotenv.config({ path: path.join(__dirname, configFile) });

export const TEST_MNEMONIC =
	"agree ill brick grant cement security expire appear unknown law toe keep believe project whale welcome easy twenty deposit hour doctor witness edit mimic";
export const TEST_SECRET_MANAGER: MnemonicSecretManager = { mnemonic: TEST_MNEMONIC };
export const TEST_CLIENT_OPTIONS: IClientOptions = {
	nodes: [process.env.TEST_NODE_ENDPOINT ?? ""],
	localPow: true
};
export const TEST_WALLET_PROVIDER = new IotaWalletProvider(
	{
		clientOptions: TEST_CLIENT_OPTIONS,
		secretManager: TEST_SECRET_MANAGER
	},
	new IotaFaucetProvider({
		clientOptions: TEST_CLIENT_OPTIONS,
		endpoint: process.env.TEST_FAUCET_ENDPOINT ?? ""
	})
);
const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
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

/**
 * Initialise the test wallet.
 */
export async function initTestWallet(): Promise<void> {
	console.log("Wallet Address", `${process.env.TEST_EXPLORER_ADDRESS}${TEST_ADDRESS_BECH32}`);
	// await TEST_WALLET_PROVIDER.ensureBalance(TEST_ADDRESS_BECH32, 1000000000n);
}

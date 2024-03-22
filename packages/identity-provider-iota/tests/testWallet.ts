// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { KeyType, Bip39, Bip44 } from "@gtsc/crypto";
import { IotaFaucet, IotaWalletProvider } from "@gtsc/wallet-provider-iota";
import { CoinType, type IClientOptions, type MnemonicSecretManager } from "@iota/sdk-wasm/node";

export const TEST_NODE_ENDPOINT = "https://api.testnet.shimmer.network";
export const TEST_FAUCET_ENDPOINT = "https://faucet.testnet.shimmer.network/api/enqueue";
export const TEST_COIN_TYPE = CoinType.Shimmer;
export const TEST_BECH32_HRP = "rms";
export const TEST_EXPLORER_ADDRESS = "https://explorer.shimmer.network/testnet/addr/";
export const TEST_EXPLORER_SEARCH = "https://explorer.shimmer.network/testnet/search/";

export const TEST_MNEMONIC =
	"agree ill brick grant cement security expire appear unknown law toe keep believe project whale welcome easy twenty deposit hour doctor witness edit mimic";
export const TEST_SECRET_MANAGER: MnemonicSecretManager = { mnemonic: TEST_MNEMONIC };
export const TEST_CLIENT_OPTIONS: IClientOptions = {
	nodes: [TEST_NODE_ENDPOINT],
	localPow: true
};
export const TEST_WALLET_PROVIDER = new IotaWalletProvider(
	{
		clientOptions: TEST_CLIENT_OPTIONS,
		secretManager: TEST_SECRET_MANAGER
	},
	new IotaFaucet({
		clientOptions: TEST_CLIENT_OPTIONS,
		endpoint: TEST_FAUCET_ENDPOINT
	})
);
const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
const addressKeyPair = Bip44.addressBech32(
	seed,
	KeyType.Ed25519,
	TEST_BECH32_HRP,
	TEST_COIN_TYPE,
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
	console.log("Wallet Address", `${TEST_EXPLORER_ADDRESS}${TEST_ADDRESS_BECH32}`);
	await TEST_WALLET_PROVIDER.ensureBalance(TEST_ADDRESS_BECH32, 1000000000n);
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Guards, Is } from "@gtsc/core";
import { Bip39 } from "@gtsc/crypto";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import { nameof } from "@gtsc/nameof";
import type { IServiceRequestContext } from "@gtsc/services";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import { IotaWalletConnector } from "@gtsc/wallet-connector-iota";
import type { IClientOptions } from "@iota/sdk-wasm/node/lib/index.js";
import * as dotenv from "dotenv";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({ path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")] });

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_FAUCET_ENDPOINT", process.env.TEST_FAUCET_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_BECH32_HRP", process.env.TEST_BECH32_HRP);
Guards.stringValue("TestEnv", "TEST_COIN_TYPE", process.env.TEST_COIN_TYPE);
Guards.stringValue("TestEnv", "TEST_EXPLORER_URL", process.env.TEST_EXPLORER_URL);
if (!Is.stringValue(process.env.TEST_MNEMONIC)) {
	// eslint-disable-next-line no-restricted-syntax
	throw new Error(
		`Please define TEST_MNEMONIC as a 24 word mnemonic either as an environment variable or inside an .env.dev file
		 e.g. TEST_MNEMONIC="word0 word1 ... word23"`
	);
}

export const TEST_PARTITION_ID = "test-parition";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";

initSchema();

EntityStorageConnectorFactory.register(
	"vault-key",
	() =>
		new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>()
		})
);
const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
	entitySchema: nameof<VaultSecret>()
});
EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

export const TEST_CLIENT_OPTIONS: IClientOptions = {
	nodes: [process.env.TEST_NODE_ENDPOINT],
	localPow: true
};

export const TEST_SEED = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC);
export const TEST_COIN_TYPE = Number.parseInt(process.env.TEST_COIN_TYPE, 10);
export const TEST_BECH32_HRP = process.env.TEST_BECH32_HRP;

export const TEST_WALLET_CONNECTOR = new IotaWalletConnector({
	config: {
		clientOptions: TEST_CLIENT_OPTIONS,
		vaultMnemonicId: TEST_MNEMONIC_NAME,
		coinType: TEST_COIN_TYPE,
		bech32Hrp: TEST_BECH32_HRP
	}
});

export const TEST_CONTEXT: IServiceRequestContext = {
	partitionId: TEST_PARTITION_ID,
	identity: TEST_IDENTITY_ID
};

await secretEntityStorage.set(
	{
		id: `${TEST_IDENTITY_ID}/${TEST_MNEMONIC_NAME}`,
		data: JSON.stringify(process.env.TEST_MNEMONIC)
	},
	TEST_CONTEXT
);

const addresses = await TEST_WALLET_CONNECTOR.getAddresses(0, 1, TEST_CONTEXT);
export const TEST_IDENTITY_ADDRESS_BECH32 = addresses[0];

/**
 * Setup the test environment.
 */
export async function setupTestEnv(): Promise<void> {
	console.debug(
		"Identity Address",
		`${process.env.TEST_EXPLORER_URL}addr/${TEST_IDENTITY_ADDRESS_BECH32}`
	);
	await TEST_WALLET_CONNECTOR.ensureBalance(
		TEST_IDENTITY_ADDRESS_BECH32,
		1000000000n,
		undefined,
		TEST_CONTEXT
	);
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import path from "node:path";
import { Guards, Is } from "@gtsc/core";
import { Bip39 } from "@gtsc/crypto";
import { EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import type { IRequestContext } from "@gtsc/services";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import type { IVaultConnector } from "@gtsc/vault-models";
import { IotaFaucetConnector, IotaWalletConnector } from "@gtsc/wallet-connector-iota";
import type { IClientOptions } from "@iota/sdk-wasm/node";
import * as dotenv from "dotenv";

console.log("Setting up test environment from .env and .env.dev files");

dotenv.config({ path: [path.join(__dirname, ".env"), path.join(__dirname, ".env.dev")] });

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_FAUCET_ENDPOINT", process.env.TEST_FAUCET_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_BECH32_HRP", process.env.TEST_BECH32_HRP);
Guards.stringValue("TestEnv", "TEST_COIN_TYPE", process.env.TEST_COIN_TYPE);
Guards.stringValue("TestEnv", "TEST_EXPLORER_URL", process.env.TEST_EXPLORER_URL);
Guards.stringValue(
	"TestEnv",
	"TEST_IDENTITY_ADDRESS_INDEX",
	process.env.TEST_IDENTITY_ADDRESS_INDEX
);
if (!Is.stringValue(process.env.TEST_MNEMONIC)) {
	// eslint-disable-next-line no-restricted-syntax
	throw new Error(
		`Please define TEST_MNEMONIC as a 24 word mnemonic either as an environment variable or inside an .env.dev file
		 e.g. TEST_MNEMONIC="word0 word1 ... word23"`
	);
}

export const TEST_TENANT_ID = "test-tenant";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";

export const TEST_VAULT_KEY_STORAGE = new MemoryEntityStorageConnector<VaultKey>(
	EntitySchemaHelper.getSchema(VaultKey)
);

export const TEST_VAULT_SECRET_STORAGE = new MemoryEntityStorageConnector<VaultSecret>(
	EntitySchemaHelper.getSchema(VaultSecret),
	{
		initialValues: {
			[TEST_TENANT_ID]: [
				{
					id: `${TEST_IDENTITY_ID}/${TEST_MNEMONIC_NAME}`,
					data: JSON.stringify(process.env.TEST_MNEMONIC)
				}
			]
		}
	}
);

export const TEST_VAULT_CONNECTOR: IVaultConnector = new EntityStorageVaultConnector({
	vaultKeyEntityStorageConnector: TEST_VAULT_KEY_STORAGE,
	vaultSecretEntityStorageConnector: TEST_VAULT_SECRET_STORAGE
});

export const TEST_CLIENT_OPTIONS: IClientOptions = {
	nodes: [process.env.TEST_NODE_ENDPOINT],
	localPow: true
};

export const TEST_SEED = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC);
export const TEST_COIN_TYPE = Number.parseInt(process.env.TEST_COIN_TYPE, 10);
export const TEST_BECH32_HRP = process.env.TEST_BECH32_HRP;

export const TEST_WALLET_CONNECTOR = new IotaWalletConnector(
	{
		vaultConnector: TEST_VAULT_CONNECTOR,
		faucetConnector: new IotaFaucetConnector({
			clientOptions: TEST_CLIENT_OPTIONS,
			endpoint: process.env.TEST_FAUCET_ENDPOINT
		})
	},
	{
		clientOptions: TEST_CLIENT_OPTIONS,
		walletMnemonicId: TEST_MNEMONIC_NAME,
		coinType: TEST_COIN_TYPE,
		bech32Hrp: TEST_BECH32_HRP
	}
);

export const TEST_CONTEXT: IRequestContext = {
	tenantId: TEST_TENANT_ID,
	identity: TEST_IDENTITY_ID
};

export const TEST_IDENTITY_ADDRESS_INDEX = Number.parseInt(
	process.env.TEST_IDENTITY_ADDRESS_INDEX,
	10
);

const addresses = await TEST_WALLET_CONNECTOR.getAddresses(
	TEST_CONTEXT,
	TEST_IDENTITY_ADDRESS_INDEX,
	1
);
export const TEST_IDENTITY_ADDRESS_BECH32 = addresses[0];

/**
 * Setup the test environment.
 */
export async function setupTestEnv(): Promise<void> {
	console.log(
		"Identity Address",
		`${process.env.TEST_EXPLORER_URL}addr/${TEST_IDENTITY_ADDRESS_BECH32}`
	);
	await TEST_WALLET_CONNECTOR.ensureBalance(
		TEST_CONTEXT,
		TEST_IDENTITY_ADDRESS_BECH32,
		1000000000n
	);
}

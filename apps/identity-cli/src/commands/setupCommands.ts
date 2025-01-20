// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { IotaIdentityConnector } from "@twin.org/identity-connector-iota";
import { IotaRebasedIdentityConnector } from "@twin.org/identity-connector-iota-rebased";
import type { IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Setup the vault for use in the CLI commands.
 */
export function setupVault(): void {
	initSchema();

	EntityStorageConnectorFactory.register(
		"vault-key",
		() =>
			new MemoryEntityStorageConnector<VaultKey>({
				entitySchema: nameof<VaultKey>()
			})
	);
	EntityStorageConnectorFactory.register(
		"vault-secret",
		() =>
			new MemoryEntityStorageConnector<VaultSecret>({
				entitySchema: nameof<VaultSecret>()
			})
	);

	const vaultConnector = new EntityStorageVaultConnector();
	VaultConnectorFactory.register("vault", () => vaultConnector);
}

/**
 * Setup the identity connector for use in the CLI commands.
 * @param options The options for the identity connector.
 * @param options.nodeEndpoint The node endpoint.
 * @param options.network The network.
 * @param options.addressIndex The wallet index.
 * @param options.vaultSeedId The vault seed ID.
 * @param connector The connector to use.
 * @returns The identity connector.
 */
export function setupIdentityConnector(
	options: { nodeEndpoint: string; network?: string; addressIndex?: number; vaultSeedId?: string },
	connector?: IdentityConnectorTypes
): IIdentityConnector {
	connector ??= IdentityConnectorTypes.Iota;

	if (connector === IdentityConnectorTypes.IotaRebased) {
		return new IotaRebasedIdentityConnector({
			config: {
				clientOptions: {
					url: options.nodeEndpoint
				},
				network: options.network ?? "",
				vaultSeedId: options.vaultSeedId,
				walletAddressIndex: options.addressIndex
			}
		});
	}
	return new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [options.nodeEndpoint],
				localPow: true
			},
			vaultSeedId: options.vaultSeedId,
			walletAddressIndex: options.addressIndex
		}
	});
}

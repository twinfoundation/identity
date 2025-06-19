// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IdentityClientReadOnly } from "@iota/identity-wasm/node/index.js";
import { IotaClient } from "@iota/iota-sdk/client";
import { DEFAULT_IDENTITY_PKG_IDS } from "../constants/defaultIdentityPkgIds";
import type { IIotaIdentityConnectorConfig } from "../models/IIotaIdentityConnectorConfig";

/**
 * Utility class for IOTA identity operations.
 */
export class IotaIdentityUtils {
	/**
	 * Creates a read-only identity client.
	 * @returns The read-only identity client.
	 * @internal
	 */
	public static async createClient(
		config: IIotaIdentityConnectorConfig
	): Promise<IdentityClientReadOnly> {
		const iotaClient = new IotaClient(config.clientOptions);

		if (config.network === "testnet" || config.network === "devnet") {
			return IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				DEFAULT_IDENTITY_PKG_IDS[config.network]
			);
		}

		return IdentityClientReadOnly.create(iotaClient);
	}
}

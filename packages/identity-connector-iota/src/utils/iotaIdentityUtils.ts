// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { DEFAULT_IDENTITY_PKG_IDS } from "../constants/defaultIdentityPkgIds";
import type { IIotaIdentityConnectorConfig } from "../models/IIotaIdentityConnectorConfig";

/**
 * Gets the identity package ID to use, either from config or defaults.
 * @param config The IOTA identity connector configuration.
 * @returns The identity package ID.
 */
export function getIdentityPkgId(config: IIotaIdentityConnectorConfig): string {
	if (config.identityPkgId) {
		return config.identityPkgId;
	}

	const clientOptions = config.clientOptions;
	const url =
		typeof clientOptions === "object" && "url" in clientOptions
			? (clientOptions.url as string)
			: "";

	const isTestnet = url.includes("testnet");

	return isTestnet ? DEFAULT_IDENTITY_PKG_IDS.TESTNET : DEFAULT_IDENTITY_PKG_IDS.DEVNET;
}

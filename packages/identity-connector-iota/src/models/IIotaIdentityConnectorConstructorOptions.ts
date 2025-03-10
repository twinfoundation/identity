// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaIdentityConnectorConfig } from "./IIotaIdentityConnectorConfig";

/**
 * Options for the IOTA Identity Connector constructor.
 */
export interface IIotaIdentityConnectorConstructorOptions {
	/**
	 * The vault connector type for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;

	/**
	 * The wallet connector.
	 * @default wallet
	 */
	walletConnectorType?: string;

	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaIdentityConnectorConfig;
}

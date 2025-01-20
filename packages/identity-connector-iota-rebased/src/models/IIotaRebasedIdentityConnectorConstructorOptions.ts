// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaRebasedIdentityConnectorConfig } from "./IIotaRebasedIdentityConnectorConfig";

/**
 * Options for the IOTA Rebased Identity Connector constructor.
 */
export interface IIotaRebasedIdentityConnectorConstructorOptions {
	/**
	 * The vault connector type for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;

	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaRebasedIdentityConnectorConfig;
}

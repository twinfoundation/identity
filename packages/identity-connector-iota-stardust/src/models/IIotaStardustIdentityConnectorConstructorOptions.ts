// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaStardustIdentityConnectorConfig } from "./IIotaStardustIdentityConnectorConfig";

/**
 * Options for the IOTA Stardust Identity Connector constructor.
 */
export interface IIotaStardustIdentityConnectorConstructorOptions {
	/**
	 * The vault connector type for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;

	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaStardustIdentityConnectorConfig;
}

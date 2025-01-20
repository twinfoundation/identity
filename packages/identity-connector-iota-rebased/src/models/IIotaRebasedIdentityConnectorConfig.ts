// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaRebasedConfig } from "@twin.org/dlt-iota-rebased";

/**
 * Configuration for the IOTA Rebased Identity Connector.
 */
export interface IIotaRebasedIdentityConnectorConfig extends IIotaRebasedConfig {
	/**
	 * The wallet address index to use for funding and controlling the identity.
	 * @default 0
	 */
	walletAddressIndex?: number;
}

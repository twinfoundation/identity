// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaConfig } from "@twin.org/dlt-iota";

/**
 * Configuration for the IOTA Identity Connector.
 */
export interface IIotaIdentityConnectorConfig extends IIotaConfig {
	/**
	 * The wallet address index to use for funding and controlling the identity.
	 * @default 0
	 */
	walletAddressIndex?: number;
}

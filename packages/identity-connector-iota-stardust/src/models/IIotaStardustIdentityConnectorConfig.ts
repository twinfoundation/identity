// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaStardustConfig } from "@twin.org/dlt-iota-stardust";

/**
 * Configuration for the IOTA Stardust Identity Connector.
 */
export interface IIotaStardustIdentityConnectorConfig extends IIotaStardustConfig {
	/**
	 * The wallet address index to use for funding and controlling the identity.
	 * @default 0
	 */
	walletAddressIndex?: number;
}

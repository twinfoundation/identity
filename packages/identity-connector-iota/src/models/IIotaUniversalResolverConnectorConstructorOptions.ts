// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaUniversalResolverConnectorConfig } from "./IIotaUniversalResolverConnectorConfig";

/**
 * Options for the IOTA Universal Resolver Connector constructor.
 */
export interface IIotaUniversalResolverConnectorConstructorOptions {
	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaUniversalResolverConnectorConfig;
}

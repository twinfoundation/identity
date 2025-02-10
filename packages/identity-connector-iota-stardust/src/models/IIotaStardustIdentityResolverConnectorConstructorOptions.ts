// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaStardustIdentityResolverConnectorConfig } from "./IIotaStardustIdentityResolverConnectorConfig";

/**
 * Options for the IOTA Stardust Identity Resolver Connector constructor.
 */
export interface IIotaStardustIdentityResolverConnectorConstructorOptions {
	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaStardustIdentityResolverConnectorConfig;
}

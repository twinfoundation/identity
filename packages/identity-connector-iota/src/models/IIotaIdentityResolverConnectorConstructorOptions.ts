// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaIdentityResolverConnectorConfig } from "./IIotaIdentityResolverConnectorConfig";

/**
 * Options for the IOTA Identity Resolver Connector constructor.
 */
export interface IIotaIdentityResolverConnectorConstructorOptions {
	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaIdentityResolverConnectorConfig;
}

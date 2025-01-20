// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaRebasedIdentityResolverConnectorConfig } from "./IIotaRebasedIdentityResolverConnectorConfig";

/**
 * Options for the IOTA Rebased Identity Resolver Connector constructor.
 */
export interface IIotaRebasedIdentityResolverConnectorConstructorOptions {
	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaRebasedIdentityResolverConnectorConfig;
}

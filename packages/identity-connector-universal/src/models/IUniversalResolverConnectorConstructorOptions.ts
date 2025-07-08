// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IUniversalResolverConnectorConfig } from "./IUniversalResolverConnectorConfig";

/**
 * Options for the Universal Resolver Connector constructor.
 */
export interface IUniversalResolverConnectorConstructorOptions {
	/**
	 * The configuration for the identity connector.
	 */
	config: IUniversalResolverConnectorConfig;
}

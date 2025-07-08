// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityResolverServiceConfig } from "./IIdentityResolverServiceConfig";

/**
 * Options for the identity resolver service constructor.
 */
export interface IIdentityResolverServiceConstructorOptions {
	/**
	 * Fallback connector type to use if the namespace connector is not available.
	 * @default universal
	 */
	fallbackResolverConnectorType?: string;

	/**
	 * The configuration for the identity service.
	 */
	config?: IIdentityResolverServiceConfig;
}

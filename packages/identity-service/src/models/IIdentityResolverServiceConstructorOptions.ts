// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityResolverServiceConfig } from "./IIdentityResolverServiceConfig";

/**
 * Options for the identity resolver service constructor.
 */
export interface IIdentityResolverServiceConstructorOptions {
	/**
	 * The configuration for the identity service.
	 */
	config?: IIdentityResolverServiceConfig;
}

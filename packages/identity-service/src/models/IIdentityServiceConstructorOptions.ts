// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityServiceConfig } from "./IIdentityServiceConfig";

/**
 * Options for the identity service constructor.
 */
export interface IIdentityServiceConstructorOptions {
	/**
	 * The configuration for the identity service.
	 */
	config?: IIdentityServiceConfig;
}

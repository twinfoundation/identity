// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the Identity Resolver Service.
 */
export interface IIdentityResolverServiceConfig {
	/**
	 * What is the default connector to use for Identity. If not provided the first connector from the factory will be used.
	 */
	defaultNamespace?: string;
}

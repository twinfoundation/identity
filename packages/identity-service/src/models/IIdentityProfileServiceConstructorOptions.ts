// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Options for the identity profile service constructor.
 */
export interface IIdentityProfileServiceConstructorOptions {
	/**
	 * The storage connector for the profiles.
	 * @default identity-profile
	 */
	profileEntityConnectorType?: string;
}

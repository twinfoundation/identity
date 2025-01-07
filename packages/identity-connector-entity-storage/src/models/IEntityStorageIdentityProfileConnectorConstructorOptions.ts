// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Options for the entity storage identity profile connector constructor.
 */
export interface IEntityStorageIdentityProfileConnectorConstructorOptions {
	/**
	 * The storage connector for the profiles.
	 * @default identity-profile
	 */
	profileEntityStorageType?: string;
}

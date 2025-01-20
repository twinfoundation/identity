// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Options for the entity storage identity connector constructor.
 */
export interface IEntityStorageIdentityResolverConnectorConstructorOptions {
	/**
	 * The entity storage for the did documents.
	 * @default identity-document
	 */
	didDocumentEntityStorageType?: string;

	/**
	 * The vault for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;
}

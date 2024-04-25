// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IClientOptions } from "@iota/sdk-wasm/node";

/**
 * The default index to use for storing identities.
 */
export const DEFAULT_IDENTITY_ACCOUNT_INDEX = 1000000;

/**
 * Configuration for the IOTA Identity Provider.
 */
export interface IIotaIdentityProviderConfig {
	/**
	 * The configuration for the client.
	 */
	clientOptions: IClientOptions;

	/**
	 * The account index of the address to use for storing identities. Defaults to DEFAULT_IDENTITY_ACCOUNT_INDEX
	 */
	accountIndex?: number;
}

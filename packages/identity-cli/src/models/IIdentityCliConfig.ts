// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Configuration model for the identity CLI.
 */
export interface IIdentityCliConfig {
	/**
	 * Configuration to use when the identity connector is IOTA.
	 */
	iota: {
		/**
		 * The node endpoint for making requests to the IOTA network.
		 */
		nodeEndpoint: string;
	};
}

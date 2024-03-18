// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Create a new identity.
 */
export interface IIdentityCreateResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The identity created.
		 */
		identity: string;

		/**
		 * Recovery phrase mnemonic.
		 */
		recoveryPhrase: string;

		/**
		 * Private key.
		 */
		privateKey: string;

		/**
		 * Public key.
		 */
		publicKey: string;
	};
}

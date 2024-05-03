// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Sign the requested data.
 */
export interface ISignDataRequest {
	/**
	 * The identity to sign the data with.
	 */
	identity: string;

	/**
	 * The data to be used in the signing.
	 */
	data: {
		/**
		 * The bytes for the document encoded as hex.
		 */
		bytes: string;

		/**
		 * The verification method to use for signing.
		 */
		verificationMethod: string;
	};
}

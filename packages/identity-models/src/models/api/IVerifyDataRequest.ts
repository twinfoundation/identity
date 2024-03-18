// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Verify some signed data.
 */
export interface IVerifyDataRequest {
	/**
	 * The identity to verify the data for.
	 */
	identity: string;

	/**
	 * The data to be used in the verification.
	 */
	data: {
		/**
		 * The bytes for the document encoded as hex.
		 */
		bytes: string;

		/**
		 * The verification method to use for verification.
		 */
		verificationMethod: string;

		/**
		 * The type of the signature.
		 */
		signatureType: string;

		/**
		 * The value of the signature.
		 */
		signatureValue: string;
	};
}

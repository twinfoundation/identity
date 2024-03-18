// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The response to a sign data request.
 */
export interface ISignDataResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The type of signature generated.
		 */
		signatureType: string;

		/**
		 * The value of the signature.
		 */
		signatureValue: string;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to create a proof.
 */
export interface IIdentityProofCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the proof for.
		 */
		identity: string;

		/**
		 * The verification method id to use.
		 */
		verificationMethodId: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The data bytes base64 encoded.
		 */
		bytes: string;
	};
}

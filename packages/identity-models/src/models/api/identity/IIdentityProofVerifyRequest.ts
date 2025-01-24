// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidProof } from "@twin.org/standards-w3c-did";

/**
 * Request to verify a proof.
 */
export interface IIdentityProofVerifyRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The data bytes base64 encoded.
		 */
		bytes: string;

		/**
		 * The proof to verify.
		 */
		proof: IDidProof;
	};
}

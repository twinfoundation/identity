// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IProof } from "@twin.org/standards-w3c-did";

/**
 * Request to verify a proof.
 */
export interface IIdentityProofVerifyRequest {
	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The document to verify the proof for.
		 */
		document: IJsonLdNodeObject;

		/**
		 * The proof to verify.
		 */
		proof: IProof;
	};
}

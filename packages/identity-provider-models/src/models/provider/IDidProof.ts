// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing a DID Proof.
 */
export interface IDidProof {
	/**
	 * The type of the proof.
	 */
	type: string;

	/**
	 * The verification method for the proof.
	 */
	verificationMethod: string;

	/**
	 * The signature for the proof.
	 */
	signatureValue: string;
}

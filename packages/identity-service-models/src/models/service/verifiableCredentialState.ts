// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The state of a verifiable credential.
 */
export enum VerifiableCredentialState {
	/**
	 * Pending verification.
	 */
	PendingVerification = "pendingVerification",

	/**
	 * Rejected.
	 */
	Rejected = "rejected",

	/**
	 * Issued.
	 */
	Issued = "issued",

	/**
	 * Revoked.
	 */
	Revoked = "revoked"
}

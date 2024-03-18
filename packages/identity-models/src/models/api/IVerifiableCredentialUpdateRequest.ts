// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { VerifiableCredentialState } from "../service/verifiableCredentialState";

/**
 * Update a verifiable credential.
 */
export interface IVerifiableCredentialUpdateRequest {
	/**
	 * The verifiable credential to update.
	 */
	verifiableCredentialId: string;

	/**
	 * The request payload.
	 */
	data: {
		/**
		 * The new state of the credential.
		 */
		state: VerifiableCredentialState;

		/**
		 * The reason for the rejection if that is the new state.
		 */
		rejectedCode?: string;
	};
}

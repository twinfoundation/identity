// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Response to creating a verifiable credential.
 */
export interface IVerifiableCredentialCreateResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The identifier for the verifiable credential.
		 */
		id: string;
	};
}

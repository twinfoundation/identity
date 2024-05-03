// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@gtsc/standards-w3c-did";

/**
 * Get a verifiable credential.
 */
export interface IVerifiableCredentialCheckRequest<T> {
	/**
	 * The data payload to send.
	 */
	data: {
		/**
		 * The verifiable credential to check.
		 */
		verifiableCredential: IDidVerifiableCredential<T>;
	};
}

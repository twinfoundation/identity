// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@gtsc/identity-provider-models";

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

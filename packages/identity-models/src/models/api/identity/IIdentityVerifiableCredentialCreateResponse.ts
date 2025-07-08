// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@twin.org/standards-w3c-did";

/**
 * Response to creating a verifiable credential.
 */
export interface IIdentityVerifiableCredentialCreateResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The verifiable credential that was created.
		 */
		verifiableCredential: IDidVerifiableCredential;

		/**
		 * The JWT token for the verifiable credential.
		 */
		jwt: string;
	};
}

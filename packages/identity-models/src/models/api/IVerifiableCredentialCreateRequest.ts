// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IProperty } from "@gtsc/schema";

/**
 * Create a verifiable credential.
 */
export interface IVerifiableCredentialCreateRequest {
	/**
	 * The data for the request.
	 */
	data: {
		/**
		 * The entity they want to create the verifiable credential with.
		 */
		issuer: string;

		/**
		 * The identity of the verifiable credential being created.
		 */
		subject: string;

		/**
		 * The type of verifiable credential requirements being requested.
		 */
		verifiableCredentialType: string;

		/**
		 * The completed claims providing information to the verifiable credential.
		 */
		claims?: IProperty[];
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { VerifiableCredentialState } from "../service/verifiableCredentialState";

/**
 * Get a list of verifiable applications.
 */
export interface IVerifiableCredentialApplicationsGetRequest {
	/**
	 * The identity to get the verifiable credentials for.
	 */
	identity: string;

	/**
	 * The query parameters.
	 */
	query?: {
		/**
		 * The identity is the issuer not the subject.
		 */
		identityIsIssuer?: boolean;

		/**
		 * The state of the verifiable credential applications to get.
		 */
		state?: VerifiableCredentialState;

		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;
	};
}

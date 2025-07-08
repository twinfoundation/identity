// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to revoke a verifiable credential.
 */
export interface IIdentityVerifiableCredentialRevokeRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to revoke the verification credential for.
		 */
		identity: string;

		/**
		 * The revocation index to revoke.
		 */
		revocationIndex: number;
	};
}

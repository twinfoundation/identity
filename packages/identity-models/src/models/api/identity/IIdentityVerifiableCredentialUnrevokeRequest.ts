// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to unrevoke a verifiable credential.
 */
export interface IIdentityVerifiableCredentialUnrevokeRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to unrevoke the verification credential for.
		 */
		identity: string;

		/**
		 * The revocation index to unrevoke.
		 */
		revocationIndex: number;
	};
}

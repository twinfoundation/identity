// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing the features for an identify provider.
 */
export interface IIdentityProviderFeatures {
	/**
	 * Whether the provider supports issuing and revoking Verifiable Credentials
	 * with multiple cryptographic keys.
	 */
	multipleVerificationKeysSupported: boolean;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Resolve an identity.
 */
export interface IIdentityResolveRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to get the document for.
		 */
		id: string;
	};
}

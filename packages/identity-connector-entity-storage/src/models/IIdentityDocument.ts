// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Model for the entity storage identity vault key.
 */
export interface IIdentityDocument {
	/**
	 * The identity of the document.
	 */
	id: string;

	/**
	 * The JSON stringified version of the DID document.
	 */
	document: string;

	/**
	 * The signature of the document.
	 */
	signature: string;
}

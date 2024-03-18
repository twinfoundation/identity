// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing a DID credential status.
 */
export interface IDidCredentialStatus {
	/**
	 * Additional properties.
	 */
	[key: string]: unknown;

	/**
	 * The URI id.
	 */
	id: string;

	/**
	 * The credential status type.
	 */
	type: string;
}

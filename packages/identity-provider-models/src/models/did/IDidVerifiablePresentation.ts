// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing a verifiable presentation.
 */
export interface IDidVerifiablePresentation {
	/**
	 * The context for the verifiable credential.
	 */
	"@context": string | string[];

	/**
	 * Provide a unique identifier for the presentation.
	 */
	id?: string;

	/**
	 * The types of the data stored in the verifiable credential.
	 */
	type: string[];

	/**
	 * The data for the verifiable credentials.
	 */
	verifiableCredential: string[];

	/**
	 * The entity generating the presentation.
	 */
	holder?: string;
}

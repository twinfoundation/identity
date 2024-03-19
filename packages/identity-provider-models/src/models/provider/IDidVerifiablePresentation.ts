// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IDidProof } from "./IDidProof";
import type { IDidVerifiableCredential } from "./IDidVerifiableCredential";

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
	verifiableCredential: IDidVerifiableCredential<unknown> | IDidVerifiableCredential<unknown>[];

	/**
	 * The signature proof created by the issuer.
	 */
	proof?: IDidProof;

	/**
	 * The entity generating the presentation.
	 */
	holder?: string;
}

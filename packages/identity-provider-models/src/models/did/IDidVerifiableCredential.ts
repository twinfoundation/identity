// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IDidCredentialStatus } from "./IDidCredentialStatus";

/**
 * Interface describing a verifiable credential.
 */
export interface IDidVerifiableCredential<T = unknown> {
	/**
	 * The context for the verifiable credential.
	 */
	"@context": string | string[];

	/**
	 * The identifier for the verifiable credential.
	 */
	id: string;

	/**
	 * The types of the data stored in the verifiable credential.
	 */
	type: string[];

	/**
	 * The data for the verifiable credential.
	 */
	credentialSubject: T;

	/**
	 * Used to discover information about the current status of the
	 * verifiable credential, such as whether it is suspended or revoked.
	 */
	credentialStatus?: IDidCredentialStatus;

	/**
	 * The issuing identity.
	 */
	issuer: string;

	/**
	 * The date the verifiable credential was issued.
	 */
	issuanceDate: string;
}

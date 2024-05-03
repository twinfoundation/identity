// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";
import type { IDidVerifiableCredential } from "@gtsc/standards-w3c-did";
import type { VerifiableCredentialState } from "./verifiableCredentialState";

/**
 * Interface representing the state of an verifiable credential application.
 */
export interface IIdentityVerifiableCredentialApplication {
	/**
	 * The id of the verifiable credential application.
	 */
	id: string;

	/**
	 * The identity that is issuing the verifiable credential.
	 */
	issuer: string;

	/**
	 * The identity that is the target of the verifiable credential.
	 */
	subject: string;

	/**
	 * The current state of the verifiable credential application.
	 */
	state: VerifiableCredentialState;

	/**
	 * The timestamp when the verifiable credential application was created.
	 */
	created: number;

	/**
	 * The timestamp when the verifiable credential application was updated.
	 */
	updated: number;

	/**
	 * The type of verifiable credential being requested.
	 */
	verifiableCredentialType: string;

	/**
	 * Properties supplied for the verifiable credential claims that are private.
	 */
	privateClaims?: IProperty[];

	/**
	 * Properties supplied for the verifiable credential claims that can be public.
	 */
	publicClaims?: IProperty[];

	/**
	 * The verifiable credential.
	 */
	verifiableCredential?: IDidVerifiableCredential<unknown>;

	/**
	 * The code for why the verifiable credential application was rejected.
	 */
	rejectedCode?: string;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityClaimRequirement } from "../contract/IIdentityClaimRequirement";

/**
 * Request to set the requirements for a verifiable credential.
 */
export interface IVerifiableCredentialRequirementsSetRequest {
	/**
	 * The identity of the verifiable credential requirements.
	 */
	identity: string;

	/**
	 * The type of verifiable credential requirements being stored.
	 */
	verifiableCredentialType: string;

	/**
	 * The request payload.
	 */
	data: {
		/**
		 * The requisites needed to apply for a verifiable credential.
		 */
		requiredClaims?: IIdentityClaimRequirement[];
	};
}

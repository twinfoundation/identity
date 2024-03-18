// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IIdentityClaimRequirement } from "../service/IIdentityClaimRequirement";

/**
 * Interface representing requirements for creating for a verifiable credential.
 */
export interface IIdentityVerifiableCredentialRequirements {
	/**
	 * The id for the verifiable credential requirements.
	 */
	identity: string;

	/**
	 * The type of the verifiable credential.
	 */
	verifiableCredentialType: string;

	/**
	 * E-mail domain match.
	 */
	matchDomains?: string;

	/**
	 * The requirements for verifiable credential.
	 */
	requiredClaims?: IIdentityClaimRequirement[];
}

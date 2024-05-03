// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityClaimRequirement } from "../contract/IIdentityClaimRequirement";

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
	 * The requirements for verifiable credential.
	 */
	requiredClaims?: IIdentityClaimRequirement[];
}

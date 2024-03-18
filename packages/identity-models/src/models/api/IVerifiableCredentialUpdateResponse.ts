// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityVerifiableCredentialApplication } from "../service/IIdentityVerifiableCredentialApplication";

/**
 * Response to an update of a verifiable credential.
 */
export interface IVerifiableCredentialUpdateResponse {
	/**
	 * The updated verifiable credential application.
	 */
	data: IIdentityVerifiableCredentialApplication;
}

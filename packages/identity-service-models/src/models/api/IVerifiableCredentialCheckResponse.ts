// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@gtsc/identity-provider-models";

/**
 * The response to get verifiable credential applications request.
 */
export interface IVerifiableCredentialCheckResponse {
	/**
	 * The verifiable credential check result.
	 */
	data: IDidVerifiableCredential;
}

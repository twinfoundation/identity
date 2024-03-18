// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidCredentialVerification } from "../provider/IDidCredentialVerification";

/**
 * The response to get verifiable credential applications request.
 */
export interface IVerifiableCredentialCheckResponse {
	/**
	 * The verifiable credential check result.
	 */
	data: IDidCredentialVerification;
}

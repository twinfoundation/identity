// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "../provider/IDidVerifiableCredential";

/**
 * The response to get verifiable credential applications request.
 */
export interface IVerifiableCredentialGetResponse<T> {
	/**
	 * The verifiable credential retrieved.
	 */
	data: IDidVerifiableCredential<T>;
}

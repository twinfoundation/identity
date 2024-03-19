// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityVerifiableCredentialApplication } from "../service/IIdentityVerifiableCredentialApplication";

/**
 * The response to get verifiable credential applications request.
 */
export interface IVerifiableCredentialApplicationsGetResponse {
	/**
	 * The response payload.
	 */
	data: {
		/**
		 * The cursor for paged requests.
		 */
		cursor?: string;

		/**
		 * The verifiable credential applications.
		 */
		applications: IIdentityVerifiableCredentialApplication[];
	};
}

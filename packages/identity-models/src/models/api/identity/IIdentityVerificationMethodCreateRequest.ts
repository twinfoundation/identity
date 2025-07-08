// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { DidVerificationMethodType } from "@twin.org/standards-w3c-did";

/**
 * Request to create a verification method.
 */
export interface IIdentityVerificationMethodCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the verification method for.
		 */
		identity: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The type of the verification method to create.
		 */
		verificationMethodType: DidVerificationMethodType;

		/**
		 * The optional id for the verification method, will be allocated if not supplied.
		 */
		verificationMethodId?: string;
	};
}

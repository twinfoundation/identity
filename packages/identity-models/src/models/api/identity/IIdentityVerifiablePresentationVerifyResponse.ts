// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument, IDidVerifiablePresentation } from "@twin.org/standards-w3c-did";

/**
 * Response to verifying a verifiable presentation.
 */
export interface IIdentityVerifiablePresentationVerifyResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * Has the presentation been revoked.
		 */
		revoked: boolean;

		/**
		 * The verifiable presentation that was verified.
		 */
		verifiablePresentation?: IDidVerifiablePresentation;

		/**
		 * The issuers of the presentation.
		 */
		issuers?: IDidDocument[];
	};
}

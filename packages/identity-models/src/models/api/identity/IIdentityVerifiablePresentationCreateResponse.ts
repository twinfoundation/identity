// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiablePresentation } from "@twin.org/standards-w3c-did";

/**
 * Response to creating a verifiable presentation.
 */
export interface IIdentityVerifiablePresentationCreateResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The verifiable presentation that was created.
		 */
		verifiablePresentation: IDidVerifiablePresentation;

		/**
		 * The JWT token for the verifiable presentation.
		 */
		jwt: string;
	};
}

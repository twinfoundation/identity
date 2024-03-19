// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "./IDidDocument";

/**
 * Interface describing the result of checking verifiable credential.
 */
export interface IDidCredentialVerification {
	/**
	 * Is the whole credential verified.
	 */
	isVerified: boolean;

	/**
	 * Who was the issuer.
	 */
	issuer?: {
		/**
		 * The id of the issuer.
		 */
		id: string;

		/**
		 * Is the issuer verified.
		 */
		isVerified: boolean;

		/**
		 * The DID document for the issuer.
		 */
		document?: IDidDocument;
	};

	/**
	 * The subjects of the verifications.
	 */
	subjects?: {
		/**
		 * The if od the subject.
		 */
		id: string;

		/**
		 * Is the subject verified.
		 */
		isVerified: boolean;

		/**
		 * The DID document for the subject.
		 */
		document?: IDidDocument;
	}[];
}

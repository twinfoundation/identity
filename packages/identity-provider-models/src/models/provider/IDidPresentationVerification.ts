// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "./IDidDocument";

/**
 * Interface describing the result of checking verifiable presentation.
 */
export interface IDidPresentationVerification {
	/**
	 * Is the whole presentation verified.
	 */
	isVerified: boolean;

	/**
	 * Who was the holder.
	 */
	holder?: {
		/**
		 * The id of the holder.
		 */
		id: string;

		/**
		 * Is the holder verified.
		 */
		isVerified: boolean;

		/**
		 * The DID document for the holder.
		 */
		document?: IDidDocument;
	};
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@twin.org/standards-w3c-did";

/**
 * Universal Resolver DIF resolution result
 */
export interface IUniversalResolverResult {
	/**
	 * DID Document resolved.
	 */
	didDocument: IDidDocument;

	/**
	 * Resolution metadata
	 */
	didResolutionMetadata: {
		/**
		 * The created date of the did document.
		 */
		created: string;

		/**
		 * The updated date of the did document.
		 */
		updated: string;
	};

	/**
	 * DID Document metadata
	 */
	didDocumentMetadata: unknown;
}

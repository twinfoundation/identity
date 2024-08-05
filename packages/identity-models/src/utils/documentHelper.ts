// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Helper methods for documents.
 */
export class DocumentHelper {
	/**
	 * Parse the document id into its parts.
	 * @param documentId The full document id.
	 * @returns The parsed document id.
	 */
	public static parse(documentId: string): {
		id: string;
		hash: string | undefined;
	} {
		const hashIndex = documentId.indexOf("#");

		return {
			id: hashIndex === -1 ? documentId : documentId.slice(0, hashIndex),
			hash: hashIndex === -1 ? undefined : documentId.slice(hashIndex + 1)
		};
	}
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is } from "@twin.org/core";

/**
 * Helper methods for documents.
 */
export class DocumentHelper {
	/**
	 * Parse the document id into its parts.
	 * @param documentId The full document id.
	 * @returns The parsed document id.
	 */
	public static parseId(documentId: string): {
		id: string;
		fragment: string | undefined;
	} {
		if (!Is.stringValue(documentId)) {
			return {
				id: "",
				fragment: ""
			};
		}

		const fragmentIndex = documentId.indexOf("#");

		return {
			id: fragmentIndex === -1 ? documentId : documentId.slice(0, fragmentIndex),
			fragment: fragmentIndex === -1 ? undefined : documentId.slice(fragmentIndex + 1)
		};
	}

	/**
	 * Join the document id parts.
	 * @param documentId The document id.
	 * @param fragment The fragment part for the identifier.
	 * @returns The full id.
	 */
	public static joinId(documentId: string, fragment?: string): string {
		if (!Is.stringValue(documentId)) {
			return "";
		}

		let fullId = documentId;

		if (Is.stringValue(fragment)) {
			if (fragment.startsWith(documentId)) {
				fragment = fragment.slice(documentId.length);
			}
			if (fragment.startsWith("#")) {
				fullId += fragment;
			} else {
				fullId += `#${fragment}`;
			}
		}

		return fullId;
	}
}

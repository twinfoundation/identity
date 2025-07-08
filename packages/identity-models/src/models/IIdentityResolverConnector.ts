// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { IDidDocument } from "@twin.org/standards-w3c-did";

/**
 * Interface describing an identity connector.
 */
export interface IIdentityResolverConnector extends IComponent {
	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	resolveDocument(documentId: string): Promise<IDidDocument>;
}

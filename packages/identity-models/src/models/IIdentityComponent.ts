// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";
import type { IDidDocument } from "@gtsc/standards-w3c-did";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentityComponent extends IComponent {
	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	resolve(documentId: string): Promise<IDidDocument>;
}

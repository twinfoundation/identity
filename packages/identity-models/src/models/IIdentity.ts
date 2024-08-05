// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IService } from "@gtsc/services";
import type { IDidDocument } from "@gtsc/standards-w3c-did";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentity extends IService {
	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	resolve(documentId: string): Promise<IDidDocument>;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@gtsc/entity";
import type { IDidDocument } from "@gtsc/standards-w3c-did";

/**
 * Class describing the identity document.
 */
@entity()
export class IdentityDocument {
	/**
	 * The identity of the document.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The DID document.
	 */
	@property({ type: "object" })
	public document!: IDidDocument;

	/**
	 * The signature of the document.
	 */
	@property({ type: "string" })
	public signature!: string;

	/**
	 * The controller of the document.
	 */
	@property({ type: "string" })
	public controller!: string;
}

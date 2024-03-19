// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocumentVerificationMethod } from "./IDidDocumentVerificationMethod";
import type { IDidService } from "./IDidService";

/**
 * Interface describing a DID Document.
 * Spec https://www.w3.org/TR/did-core/#did-document-properties.
 */
export interface IDidDocument {
	/**
	 * The id for the document.
	 */
	id: string;

	/**
	 * Aliases for the document.
	 */
	alsoKnownAs?: string | string[];

	/**
	 * The controller for the document.
	 */
	controller?: string | string[];

	/**
	 * The verification methods.
	 */
	verificationMethod?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The authentication methods.
	 */
	authentication?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The assertion methods.
	 */
	assertionMethod?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The key agreements.
	 */
	keyAgreement?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The capability invocations.
	 */
	capabilityInvocation?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The capability delegations.
	 */
	capabilityDelegation?: (string | IDidDocumentVerificationMethod)[];

	/**
	 * The services.
	 */
	service?: IDidService[];
}

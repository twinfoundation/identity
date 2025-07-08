// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Is } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import {
	DidVerificationMethodType,
	type IDidDocumentVerificationMethod,
	type IDidDocument
} from "@twin.org/standards-w3c-did";
import type { IJwk } from "@twin.org/web";

/**
 * Helper methods for documents.
 */
export class DocumentHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<DocumentHelper>();

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

	/**
	 * Get a verification method from a DID document.
	 * @param didDocument The DID Document to get the method from.
	 * @param methodName The name of the method to get the JWK from.
	 * @param methodType The type of the method, defaults to verificationMethod.
	 * @returns The verification method if found.
	 * @throws Error if the method is not found.
	 */
	public static getVerificationMethod(
		didDocument: IDidDocument,
		methodName: string,
		methodType?: DidVerificationMethodType
	): IDidDocumentVerificationMethod {
		const verificationMethod = didDocument[
			methodType ?? DidVerificationMethodType.VerificationMethod
		]?.find(vm => Is.object(vm) && vm.id === methodName);

		if (Is.object<IDidDocumentVerificationMethod>(verificationMethod)) {
			return verificationMethod;
		}
		throw new GeneralError(DocumentHelper.CLASS_NAME, "verificationMethodNotFound", {
			methodName,
			methodType
		});
	}

	/**
	 * Gets a JWK from a DID document verification method.
	 * @param didDocument The DID Document to get the method from.
	 * @param methodName The name of the method to get the JWK from.
	 * @param methodType The type of the method, defaults to verificationMethod.
	 * @returns The JWK if found.
	 * @throws Error if the method is not found.
	 */
	public static getJwk(
		didDocument: IDidDocument,
		methodName: string,
		methodType?: DidVerificationMethodType
	): IJwk {
		const verificationMethod = DocumentHelper.getVerificationMethod(
			didDocument,
			methodName,
			methodType
		);

		if (Is.object(verificationMethod) && Is.object(verificationMethod.publicKeyJwk)) {
			return verificationMethod.publicKeyJwk;
		}

		throw new GeneralError(DocumentHelper.CLASS_NAME, "verificationMethodJwkNotFound", {
			methodName,
			methodType
		});
	}
}

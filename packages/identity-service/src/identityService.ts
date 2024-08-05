// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Urn } from "@gtsc/core";
import {
	IdentityConnectorFactory,
	type IIdentity,
	type IIdentityConnector
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IDidDocument } from "@gtsc/standards-w3c-did";
import type { IIdentityServiceConfig } from "./models/IIdentityServiceConfig";

/**
 * Class which implements the identity contract.
 */
export class IdentityService implements IIdentity {
	/**
	 * The namespace supported by the identity service.
	 */
	public static readonly NAMESPACE: string = "did";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * Create a new instance of IdentityService.
	 * @param config The configuration for the service.
	 */
	constructor(config?: IIdentityServiceConfig) {
		const names = IdentityConnectorFactory.names();
		if (names.length === 0) {
			throw new GeneralError(this.CLASS_NAME, "noConnectors");
		}
	}

	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async resolve(documentId: string): Promise<IDidDocument> {
		Urn.guard(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const identityConnector = this.getConnector(documentId);

			const document = await identityConnector.resolveDocument(documentId);

			return document;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "resolveFailed", undefined, error);
		}
	}

	/**
	 * Get the connector from the uri.
	 * @param id The id of the identity in urn format.
	 * @returns The connector.
	 * @internal
	 */
	private getConnector(id: string): IIdentityConnector {
		const idUri = Urn.fromValidString(id);

		if (idUri.namespaceIdentifier() !== IdentityService.NAMESPACE) {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: IdentityService.NAMESPACE,
				id
			});
		}

		return IdentityConnectorFactory.get<IIdentityConnector>(idUri.namespaceMethod());
	}
}

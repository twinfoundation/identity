// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Guards, NotImplementedError } from "@twin.org/core";
import type { IIdentityResolverConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import type { IIotaRebasedIdentityResolverConnectorConfig } from "./models/IIotaRebasedIdentityResolverConnectorConfig";
import type { IIotaRebasedIdentityResolverConnectorConstructorOptions } from "./models/IIotaRebasedIdentityResolverConnectorConstructorOptions";

/**
 * Class for performing identity operations on IOTA.
 */
export class IotaRebasedIdentityResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "iota-rebased";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IotaRebasedIdentityResolverConnector>();

	/**
	 * Create a new instance of IotaIdentityConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IIotaRebasedIdentityResolverConnectorConstructorOptions) {
		Guards.object(this.CLASS_NAME, nameof(options), options);
		Guards.object<IIotaRebasedIdentityResolverConnectorConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		throw new NotImplementedError(this.CLASS_NAME, "resolveDocument");
	}
}

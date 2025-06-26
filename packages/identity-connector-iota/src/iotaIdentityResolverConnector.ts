// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	IdentityClientReadOnly,
	type IotaDocument,
	Resolver
} from "@iota/identity-wasm/node/index.js";
import { IotaClient } from "@iota/iota-sdk/client";
import { GeneralError, Guards, Is, NotFoundError } from "@twin.org/core";
import { Iota } from "@twin.org/dlt-iota";
import type { IIdentityResolverConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import type { IIotaIdentityConnectorConfig } from "./models/IIotaIdentityConnectorConfig";
import type { IIotaIdentityResolverConnectorConfig } from "./models/IIotaIdentityResolverConnectorConfig";
import type { IIotaIdentityResolverConnectorConstructorOptions } from "./models/IIotaIdentityResolverConnectorConstructorOptions";

/**
 * Class for performing identity operations on IOTA.
 */
export class IotaIdentityResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "iota";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IotaIdentityResolverConnector>();

	/**
	 * The configuration to use for IOTA operations.
	 * @internal
	 */
	private readonly _config: IIotaIdentityConnectorConfig;

	/**
	 * Create a new instance of IotaIdentityResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IIotaIdentityResolverConnectorConstructorOptions) {
		Guards.object(this.CLASS_NAME, nameof(options), options);
		Guards.object<IIotaIdentityResolverConnectorConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.object<IIotaIdentityConnectorConfig["clientOptions"]>(
			this.CLASS_NAME,
			nameof(options.config.clientOptions),
			options.config.clientOptions
		);

		this._config = options.config;
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const identityClientReadOnly = await IdentityClientReadOnly.create(
				new IotaClient(this._config.clientOptions)
			);
			const resolver = new Resolver<IotaDocument>({
				client: identityClientReadOnly
			});
			const resolvedDocument = await resolver.resolve(documentId);

			if (Is.undefined(resolvedDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}

			const doc = resolvedDocument.toJSON() as { doc: IDidDocument };

			return doc.doc;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"resolveDocumentFailed",
				{ documentId },
				Iota.extractPayloadError(error)
			);
		}
	}
}

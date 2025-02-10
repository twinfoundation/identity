// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IotaDID, IotaIdentityClient } from "@iota/identity-wasm/node/index.js";
import { Client } from "@iota/sdk-wasm/node/lib/index.js";
import { GeneralError, Guards, Is, NotFoundError } from "@twin.org/core";
import { type IIotaStardustConfig, IotaStardust } from "@twin.org/dlt-iota-stardust";
import type { IIdentityResolverConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import type { IIotaStardustIdentityResolverConnectorConfig } from "./models/IIotaStardustIdentityResolverConnectorConfig";
import type { IIotaStardustIdentityResolverConnectorConstructorOptions } from "./models/IIotaStardustIdentityResolverConnectorConstructorOptions";

/**
 * Class for performing identity operations on IOTA Stardust.
 */
export class IotaStardustIdentityResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "iota-stardust";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IotaStardustIdentityResolverConnector>();

	/**
	 * The configuration to use for tangle operations.
	 * @internal
	 */
	private readonly _config: IIotaStardustConfig;

	/**
	 * Create a new instance of IotaStardustIdentityResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IIotaStardustIdentityResolverConnectorConstructorOptions) {
		Guards.object(this.CLASS_NAME, nameof(options), options);
		Guards.object<IIotaStardustIdentityResolverConnectorConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.object<IIotaStardustIdentityResolverConnectorConfig["clientOptions"]>(
			this.CLASS_NAME,
			nameof(options.config.clientOptions),
			options.config.clientOptions
		);

		this._config = options.config;
		IotaStardust.populateConfig(this._config);
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
			const identityClient = new IotaIdentityClient(new Client(this._config.clientOptions));

			const document = await identityClient.resolveDid(IotaDID.parse(documentId));
			if (Is.undefined(document)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			return document.toJSON() as IDidDocument;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"resolveDocumentFailed",
				undefined,
				IotaStardust.extractPayloadError(error)
			);
		}
	}
}

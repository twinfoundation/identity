// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IdentityClientReadOnly, type IotaDocument, Resolver } from "@iota/identity-wasm/node";
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
	 * Default package IDs for different networks.
	 */
	private static readonly _DEFAULT_IDENTITY_PKG_IDS = {
		/**
		 * Default package ID for testnet.
		 */
		TESTNET: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555",

		/**
		 * Default package ID for devnet.
		 */
		DEVNET: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"
	};

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
			const iotaClient = new IotaClient(this._config.clientOptions);
			const identityClientReadOnly = await IdentityClientReadOnly.createWithPkgId(
				iotaClient,
				this.getIdentityPkgId()
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

	/**
	 * Gets the identity package ID to use, either from config or defaults.
	 * @returns The identity package ID.
	 */
	private getIdentityPkgId(): string {
		if (this._config.identityPkgId) {
			return this._config.identityPkgId;
		}

		const clientOptions = this._config.clientOptions;
		const url =
			typeof clientOptions === "object" && "url" in clientOptions
				? (clientOptions.url as string)
				: "";

		const isTestnet = url.includes("testnet");

		return isTestnet
			? IotaIdentityResolverConnector._DEFAULT_IDENTITY_PKG_IDS.TESTNET
			: IotaIdentityResolverConnector._DEFAULT_IDENTITY_PKG_IDS.DEVNET;
	}
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards } from "@twin.org/core";
import type { IIdentityResolverConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import { FetchHelper, HttpMethod } from "@twin.org/web";
import type { IUniversalResolverResult } from "./models/api/IUniversalResolverResult";
import type { IUniversalResolverConnectorConfig } from "./models/IUniversalResolverConnectorConfig";
import type { IUniversalResolverConnectorConstructorOptions } from "./models/IUniversalResolverConnectorConstructorOptions";

/**
 * Class for performing identity operations on universal resolver.
 */
export class UniversalResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "universal";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<UniversalResolverConnector>();

	/**
	 * The url for the resolver.
	 * @internal
	 */
	private readonly _resolverEndpoint: string;

	/**
	 * Create a new instance of UniversalResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IUniversalResolverConnectorConstructorOptions) {
		Guards.object(this.CLASS_NAME, nameof(options), options);
		Guards.object<IUniversalResolverConnectorConfig>(
			this.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.stringValue(this.CLASS_NAME, nameof(options.config.endpoint), options.config.endpoint);

		this._resolverEndpoint = options.config.endpoint;
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		try {
			const result = await FetchHelper.fetchJson<never, IUniversalResolverResult>(
				this.CLASS_NAME,
				`${this._resolverEndpoint}/1.0/identifiers/${encodeURIComponent(documentId)}`,
				HttpMethod.GET
			);

			return result.didDocument;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "resolveDocumentFailed", { documentId }, error);
		}
	}
}

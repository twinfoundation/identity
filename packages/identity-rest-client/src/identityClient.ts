// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig } from "@gtsc/api-models";
import { Urn } from "@gtsc/core";
import type {
	IIdentityComponent,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IDidDocument } from "@gtsc/standards-w3c-did";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityClient extends BaseRestClient implements IIdentityComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityClient>(), config, "identity");
	}

	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async resolve(documentId: string): Promise<IDidDocument> {
		Urn.guard(this.CLASS_NAME, nameof(documentId), documentId);

		const response = await this.fetch<IIdentityResolveRequest, IIdentityResolveResponse>(
			"/:id",
			"GET",
			{
				pathParams: {
					id: documentId
				}
			}
		);

		return response.body;
	}
}

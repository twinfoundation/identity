// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig, ICreatedResponse } from "@gtsc/api-models";
import { Guards, StringHelper, Urn } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityCreateRequest,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IDidDocument } from "@gtsc/standards-w3c-did";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityClient extends BaseRestClient implements IIdentity {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityClient>(), config, StringHelper.kebabCase(nameof<IIdentity>()));
	}

	/**
	 * Create a new identity.
	 * @param controller The controller for the identity.
	 * @param options Additional options for the identity service.
	 * @param options.namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity details.
	 */
	public async create(
		controller: string,
		options?: {
			namespace?: string;
		}
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		const response = await this.fetch<IIdentityCreateRequest, ICreatedResponse>("/", "POST", {
			body: {
				controller,
				namespace: options?.namespace
			}
		});

		return {
			identity: response.headers.location
		};
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

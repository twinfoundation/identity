// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig, ICreatedResponse } from "@gtsc/api-models";
import { Guards, StringHelper } from "@gtsc/core";
import type { IIdentity, IIdentityCreateRequest } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";

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
	 * @returns The created identity details.
	 */
	public async create(controller: string): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		const response = await this.fetch<IIdentityCreateRequest, ICreatedResponse>("/", "POST", {
			body: {
				controller
			}
		});

		return {
			identity: response.headers.location
		};
	}
}

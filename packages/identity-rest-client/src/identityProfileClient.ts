// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig } from "@gtsc/api-models";
import { Guards, StringHelper } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityProfile,
	IIdentityProfileCreateRequest,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileProperty,
	IIdentityProfileRemoveRequest,
	IIdentityProfileUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityProfileClient extends BaseRestClient implements IIdentityProfile {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityProfileClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityProfileClient>(), config, StringHelper.kebabCase(nameof<IIdentity>()));
	}

	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param properties The properties to create the profile with.
	 * @returns Nothing.
	 */
	public async create(identity: string, properties: IIdentityProfileProperty[]): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		await this.fetch<IIdentityProfileCreateRequest, never>("", "POST", {
			body: {
				identity,
				properties
			}
		});
	}

	/**
	 * Get the profile properties for an identity.
	 * if matching authenticated user private properties are also returned.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async get(
		identity: string,
		propertyNames?: string[]
	): Promise<{
		properties?: IIdentityProfileProperty[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		const response = await this.fetch<IIdentityProfileGetRequest, IIdentityProfileGetResponse>(
			"/:identity",
			"GET",
			{
				pathParams: {
					identity
				},
				query: {
					propertyNames: propertyNames?.join(",")
				}
			}
		);

		return response.body;
	}

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async update(identity: string, properties: IIdentityProfileProperty[]): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		await this.fetch<IIdentityProfileUpdateRequest, never>("/:identity", "PUT", {
			pathParams: {
				identity
			},
			body: {
				properties
			}
		});
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @returns Nothing.
	 */
	public async remove(identity: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		await this.fetch<IIdentityProfileRemoveRequest, never>("/:identity", "DELETE", {
			pathParams: {
				identity
			}
		});
	}

	/**
	 * Get a list of the requested identities.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
		filters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The items.
		 */
		items: {
			identity: string;
			properties?: IIdentityProfileProperty[];
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
		/**
		 * Number of entities to return.
		 */
		pageSize?: number;
		/**
		 * Total entities length.
		 */
		totalEntities: number;
	}> {
		const response = await this.fetch<IIdentityProfileListRequest, IIdentityProfileListResponse>(
			"/",
			"GET",
			{
				query: {
					filters: filters?.map(f => `${f.propertyName}:${f.propertyValue}`).join(","),
					propertyNames: propertyNames?.join(","),
					cursor,
					pageSize
				}
			}
		);
		return response.body;
	}
}

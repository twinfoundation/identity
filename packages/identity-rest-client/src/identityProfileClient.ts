// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig } from "@gtsc/api-models";
import { StringHelper } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityProfile,
	IIdentityProfileCreateRequest,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileProperty,
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
	 * @param properties The properties to create the profile with.
	 * @returns Nothing.
	 */
	public async create(properties: IIdentityProfileProperty[]): Promise<void> {
		await this.fetch<IIdentityProfileCreateRequest, never>("", "POST", {
			body: {
				properties
			}
		});
	}

	/**
	 * Get the profile properties for an identity.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async get(propertyNames?: string[]): Promise<{
		properties?: IIdentityProfileProperty[];
	}> {
		const response = await this.fetch<IIdentityProfileGetRequest, IIdentityProfileGetResponse>(
			"/",
			"GET",
			{
				query: {
					propertyNames: propertyNames?.join(",")
				}
			}
		);

		return response.body;
	}

	/**
	 * Update the profile properties of an identity.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async update(properties: IIdentityProfileProperty[]): Promise<void> {
		await this.fetch<IIdentityProfileUpdateRequest, never>("/", "PUT", {
			body: {
				properties
			}
		});
	}

	/**
	 * Delete the profile for an identity.
	 * @returns Nothing.
	 */
	public async remove(): Promise<void> {
		await this.fetch<never, never>("/", "DELETE");
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
			"/query",
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

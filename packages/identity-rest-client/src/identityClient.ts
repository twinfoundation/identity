// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig, ICreatedResponse } from "@gtsc/api-models";
import { Guards, StringHelper } from "@gtsc/core";
import {
	IdentityRole,
	type IIdentity,
	type IIdentityCreateRequest,
	type IIdentityGetRequest,
	type IIdentityGetResponse,
	type IIdentityListRequest,
	type IIdentityListResponse,
	type IIdentityUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IProperty } from "@gtsc/schema";
import type { IRequestContext } from "@gtsc/services";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityClient extends BaseRestClient implements IIdentity {
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IdentityClient>();

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = IdentityClient._CLASS_NAME;

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(IdentityClient._CLASS_NAME, config, StringHelper.kebabCase(nameof<IIdentity>()));
	}

	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param controller The controller for the identity.
	 * @param role The role for the identity.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	public async identityCreate(
		requestContext: IRequestContext,
		controller: string,
		role: IdentityRole,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.arrayOneOf(this.CLASS_NAME, nameof(role), role, Object.values(IdentityRole));

		const response = await this.fetch<IIdentityCreateRequest, ICreatedResponse>(
			requestContext,
			"/",
			"POST",
			{
				body: {
					controller,
					role,
					properties
				}
			}
		);

		return {
			identity: response.headers.location
		};
	}

	/**
	 * Get an item by identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async identityGet(
		requestContext: IRequestContext,
		identity: string,
		propertyNames?: string[]
	): Promise<{
		role: IdentityRole;
		properties?: IProperty[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		const response = await this.fetch<IIdentityGetRequest, IIdentityGetResponse>(
			requestContext,
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
	 * Update an item.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async identityUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties: IProperty[]
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		await this.fetch<IIdentityUpdateRequest, never>(requestContext, "/:identity", "PUT", {
			pathParams: {
				identity
			},
			body: {
				properties
			}
		});
	}

	/**
	 * Get a list of the requested types.
	 * @param requestContext The context for the request.
	 * @param role The role type to lookup.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async identityList(
		requestContext: IRequestContext,
		role: IdentityRole,
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identities.
		 */
		identities: {
			identity: string;
			properties?: IProperty[];
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
		Guards.arrayOneOf(this.CLASS_NAME, nameof(role), role, Object.values(IdentityRole));

		const response = await this.fetch<IIdentityListRequest, IIdentityListResponse>(
			requestContext,
			"/",
			"GET",
			{
				query: {
					role,
					propertyNames: propertyNames?.join(","),
					cursor,
					pageSize
				}
			}
		);
		return response.body;
	}
}

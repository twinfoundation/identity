// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@gtsc/api-core";
import type { IBaseRestClientConfig } from "@gtsc/api-models";
import { Guards } from "@gtsc/core";
import type { IJsonLdDocument } from "@gtsc/data-json-ld";
import type {
	IIdentityProfileComponent,
	IIdentityProfileCreateRequest,
	IIdentityProfileGetPublicRequest,
	IIdentityProfileGetPublicResponse,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityProfileClient<
		T extends IJsonLdDocument = IJsonLdDocument,
		U extends IJsonLdDocument = IJsonLdDocument
	>
	extends BaseRestClient
	implements IIdentityProfileComponent<T, U>
{
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityProfileClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityProfileClient>(), config, "identity/profile");
	}

	/**
	 * Create the profile properties for an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	public async create(publicProfile?: T, privateProfile?: U): Promise<void> {
		await this.fetch<IIdentityProfileCreateRequest, never>("", "POST", {
			body: {
				publicProfile,
				privateProfile
			}
		});
	}

	/**
	 * Get the profile properties for an identity.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @returns The identity and the items properties.
	 */
	public async get(
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[]
	): Promise<{
		identity: string;
		publicProfile?: Partial<T>;
		privateProfile?: Partial<U>;
	}> {
		const response = await this.fetch<IIdentityProfileGetRequest, IIdentityProfileGetResponse>(
			"/",
			"GET",
			{
				query: {
					publicPropertyNames: publicPropertyNames?.join(","),
					privatePropertyNames: privatePropertyNames?.join(",")
				}
			}
		);

		return {
			identity: response.body.identity,
			publicProfile: response.body.publicProfile as T,
			privateProfile: response.body.privateProfile as U
		};
	}

	/**
	 * Get the public profile properties for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @param propertyNames The public properties to get for the profile, defaults to all.
	 * @returns The items properties.
	 */
	public async getPublic(identity: string, propertyNames?: (keyof T)[]): Promise<Partial<T>> {
		Guards.string(this.CLASS_NAME, nameof(identity), identity);

		const response = await this.fetch<
			IIdentityProfileGetPublicRequest,
			IIdentityProfileGetPublicResponse
		>("/:identity/public", "GET", {
			pathParams: {
				identity
			},
			query: {
				propertyNames: propertyNames?.join(",")
			}
		});

		return response.body as Partial<T>;
	}

	/**
	 * Update the profile properties of an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	public async update(publicProfile?: T, privateProfile?: U): Promise<void> {
		await this.fetch<IIdentityProfileUpdateRequest, never>("/", "PUT", {
			body: {
				publicProfile,
				privateProfile
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
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
		publicFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		publicPropertyNames?: (keyof T)[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identities.
		 */
		items: {
			identity: string;
			publicProfile?: Partial<T>;
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}> {
		const response = await this.fetch<IIdentityProfileListRequest, IIdentityProfileListResponse>(
			"/query",
			"GET",
			{
				query: {
					publicFilters: publicFilters?.map(f => `${f.propertyName}:${f.propertyValue}`).join(","),
					publicPropertyNames: publicPropertyNames?.join(","),
					cursor,
					pageSize
				}
			}
		);
		return {
			items: response.body.items as {
				identity: string;
				publicProfile?: Partial<T>;
			}[],
			cursor: response.body.cursor
		};
	}
}

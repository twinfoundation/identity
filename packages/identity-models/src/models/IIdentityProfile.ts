// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IService, IServiceRequestContext } from "@gtsc/services";
import type { IIdentityProfileProperty } from "./IIdentityProfileProperty";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfile extends IService {
	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param properties The properties to create the profile with.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	create(
		identity: string,
		properties: IIdentityProfileProperty[],
		requestContext?: IServiceRequestContext
	): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * if matching authenticated user private properties are also returned.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param requestContext The context for the request.
	 * @returns The items properties.
	 */
	get(
		identity: string,
		propertyNames?: string[],
		requestContext?: IServiceRequestContext
	): Promise<{
		properties?: IIdentityProfileProperty[];
	}>;

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	update(
		identity: string,
		properties: IIdentityProfileProperty[],
		requestContext?: IServiceRequestContext
	): Promise<void>;

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	remove(identity: string, requestContext?: IServiceRequestContext): Promise<void>;

	/**
	 * Get a list of the requested identities.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @param requestContext The context for the request.
	 * @returns The list of items and cursor for paging.
	 */
	list(
		filters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number,
		requestContext?: IServiceRequestContext
	): Promise<{
		/**
		 * The identities.
		 */
		identities: { identity: string; properties?: IIdentityProfileProperty[] }[];
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
	}>;
}

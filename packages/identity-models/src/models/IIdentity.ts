// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/schema";
import type { IRequestContext, IService } from "@gtsc/services";
import type { IdentityRole } from "./identityRole";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentity extends IService {
	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param controller The controller for the identity.
	 * @param role The role for the identity.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	identityCreate(
		requestContext: IRequestContext,
		controller: string,
		role: IdentityRole,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}>;

	/**
	 * Get an item by identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	identityGet(
		requestContext: IRequestContext,
		identity: string,
		propertyNames?: string[]
	): Promise<{
		role: IdentityRole;
		properties?: IProperty[];
	}>;

	/**
	 * Update an item.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	identityUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties: IProperty[]
	): Promise<void>;

	/**
	 * Get a list of the requested types.
	 * @param requestContext The context for the request.
	 * @param role The role type to lookup.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	identityList(
		requestContext: IRequestContext,
		role: IdentityRole,
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identities.
		 */
		identities: { identity: string; properties?: IProperty[] }[];
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

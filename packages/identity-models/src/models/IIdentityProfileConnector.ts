// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";
import type { IIdentityProfileProperty } from "./IIdentityProfileProperty";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfileConnector extends IComponent {
	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param properties The properties to create the profile with.
	 * @returns Nothing.
	 */
	create(identity: string, properties: IIdentityProfileProperty[]): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * @param identity The identity of the item to get.
	 * @param includePrivate Include private properties, defaults to true.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	get(
		identity: string,
		includePrivate?: boolean,
		propertyNames?: string[]
	): Promise<{
		properties?: IIdentityProfileProperty[];
	}>;

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	update(identity: string, properties: IIdentityProfileProperty[]): Promise<void>;

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @returns Nothing.
	 */
	remove(identity: string): Promise<void>;

	/**
	 * Get a list of the requested identities.
	 * @param includePrivate Include private properties, defaults to false.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	list(
		includePrivate?: boolean,
		filters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identities.
		 */
		items: { identity: string; properties?: IIdentityProfileProperty[] }[];
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

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";
import type { IProperty } from "@gtsc/data-core";
import type { IIdentityProfileProperty } from "./IIdentityProfileProperty";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfileComponent extends IComponent {
	/**
	 * Create the profile properties for an identity.
	 * @param properties The properties to create the profile with.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	create(properties: IIdentityProfileProperty[], identity?: string): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items identity and the properties.
	 */
	get(
		propertyNames?: string[],
		identity?: string
	): Promise<{
		identity: string;
		properties?: IIdentityProfileProperty[];
	}>;

	/**
	 * Get the public profile properties for an identity.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items properties.
	 */
	getPublic(
		propertyNames?: string[],
		identity?: string
	): Promise<{
		properties?: IProperty[];
	}>;

	/**
	 * Update the profile properties of an identity.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	update(properties: IIdentityProfileProperty[], identity?: string): Promise<void>;

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	remove(identity?: string): Promise<void>;

	/**
	 * Get a list of the requested identities.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	list(
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
	}>;
}

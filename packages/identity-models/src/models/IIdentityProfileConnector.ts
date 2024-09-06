// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfileConnector extends IComponent {
	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	create(identity: string, publicProfile?: unknown, privateProfile?: unknown): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * @param identity The identity of the item to get.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @returns The identity profile, will only return private data if you have correct permissions.
	 */
	get(
		identity: string,
		publicPropertyNames?: string[],
		privatePropertyNames?: string[]
	): Promise<{
		publicProfile?: unknown;
		privateProfile?: unknown;
	}>;

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	update(identity: string, publicProfile?: unknown, privateProfile?: unknown): Promise<void>;

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @returns Nothing.
	 */
	remove(identity: string): Promise<void>;

	/**
	 * Get a list of the requested identities.
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param privateFilters The filters to apply to the identities private profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	list(
		publicFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		privateFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		publicPropertyNames?: string[],
		privatePropertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identity profiles.
		 */
		items: {
			identity: string;
			publicProfile?: unknown;
			privateProfile?: unknown;
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}>;
}

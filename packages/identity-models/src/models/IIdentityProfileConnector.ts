// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";
import type { IJsonLdDocument } from "@gtsc/data-json-ld";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfileConnector<
	T extends IJsonLdDocument = IJsonLdDocument,
	U extends IJsonLdDocument = IJsonLdDocument
> extends IComponent {
	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	create(identity: string, publicProfile?: T, privateProfile?: U): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * @param identity The identity of the item to get.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @returns The identity profile, will only return private data if you have correct permissions.
	 */
	get(
		identity: string,
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[]
	): Promise<{
		publicProfile: Partial<T>;
		privateProfile: Partial<U>;
	}>;

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns Nothing.
	 */
	update(identity: string, publicProfile?: T, privateProfile?: U): Promise<void>;

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
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identity profiles.
		 */
		items: {
			identity: string;
			publicProfile?: Partial<T>;
			privateProfile?: Partial<U>;
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}>;
}

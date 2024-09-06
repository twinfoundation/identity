// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@gtsc/core";

/**
 * Interface describing a contract which provides profile operations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IIdentityProfileComponent<T = any, U = any> extends IComponent {
	/**
	 * Create the profile properties for an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	create(publicProfile?: T, privateProfile?: U, identity?: string): Promise<void>;

	/**
	 * Get the profile properties for an identity.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items identity and the properties.
	 */
	get(
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[],
		identity?: string
	): Promise<{
		identity: string;
		publicProfile?: Partial<T>;
		privateProfile?: Partial<U>;
	}>;

	/**
	 * Get the public profile properties for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @param propertyNames The public properties to get for the profile, defaults to all.
	 * @returns The items properties.
	 */
	getPublic(identity: string, propertyNames?: (keyof T)[]): Promise<Partial<T> | undefined>;

	/**
	 * Update the profile properties of an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	update(publicProfile?: T, privateProfile?: U, identity?: string): Promise<void>;

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	remove(identity?: string): Promise<void>;

	/**
	 * Get a list of the requested identities.
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	list(
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
	}>;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { AlreadyExistsError, BaseError, GeneralError, Guards, Is, NotFoundError } from "@gtsc/core";
import { ComparisonOperator } from "@gtsc/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@gtsc/entity-storage-models";
import type { IIdentityProfileConnector, IIdentityProfileProperty } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper } from "@gtsc/schema";
import type { IdentityProfile } from "./entities/identityProfile";
import type { IdentityProfileProperty } from "./entities/identityProfileProperty";

/**
 * Class which implements the identity profile connector contract.
 */
export class EntityStorageIdentityProfileConnector implements IIdentityProfileConnector {
	/**
	 * The namespace supported by the identity profile connector.
	 */
	public static readonly NAMESPACE: string = "entity-storage";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<EntityStorageIdentityProfileConnector>();

	/**
	 * The storage connector for the profiles.
	 * @internal
	 */
	private readonly _profileEntityStorage: IEntityStorageConnector<IdentityProfile>;

	/**
	 * Create a new instance of Identity.
	 * @param options The dependencies for the identity service.
	 * @param options.profileEntityStorageType The storage connector for the profiles, default to "identity-profile".
	 */
	constructor(options?: { profileEntityStorageType?: string }) {
		this._profileEntityStorage = EntityStorageConnectorFactory.get(
			options?.profileEntityStorageType ?? "identity-profile"
		);
	}

	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param properties The properties to create the profile with.
	 * @returns Nothing.
	 */
	public async create(identity: string, properties: IIdentityProfileProperty[]): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileEntityStorage.get(identity);

			if (!Is.empty(profile)) {
				throw new AlreadyExistsError(this.CLASS_NAME, "alreadyExists", identity);
			}

			// We map the array to an object for storage, as it makes it easier
			// to perform queries against specific keys
			const storeProperties: { [key: string]: IdentityProfileProperty } = {};
			for (const property of properties) {
				storeProperties[property.key] = {
					type: property.type,
					value: property.value,
					isPublic: property.isPublic ?? false
				};
			}

			await this._profileEntityStorage.set({
				identity,
				properties: storeProperties
			});
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "createFailed", { identity }, error);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * @param identity The identity of the item to get.
	 * @param includePrivate Include private properties, defaults to true.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async get(
		identity: string,
		includePrivate?: boolean,
		propertyNames?: string[]
	): Promise<{
		properties?: IIdentityProfileProperty[];
	}> {
		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (!profile) {
				throw new NotFoundError(this.CLASS_NAME, "getFailed", identity);
			}

			const addPrivate = includePrivate ?? true;
			const properties: IIdentityProfileProperty[] = [];
			const filterProperties = Is.arrayValue(propertyNames);

			const storeProperties: { [key: string]: IdentityProfileProperty } = profile.properties ?? {};
			for (const propertyKey in storeProperties) {
				if (
					(addPrivate || storeProperties[propertyKey].isPublic) &&
					(!filterProperties || propertyNames?.includes(propertyKey))
				) {
					properties.push({
						key: propertyKey,
						type: storeProperties[propertyKey].type,
						value: storeProperties[propertyKey].value,
						isPublic: storeProperties[propertyKey].isPublic
					});
				}
			}

			return {
				properties: PropertyHelper.filterInclude<IIdentityProfileProperty>(
					properties,
					propertyNames
				)
			};
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "getFailed", undefined, error);
		}
	}

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async update(identity: string, properties: IIdentityProfileProperty[]): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (Is.empty(profile)) {
				throw new NotFoundError(this.CLASS_NAME, "notFound", identity);
			}

			const storeProperties: { [key: string]: IdentityProfileProperty } = profile.properties ?? {};
			for (const property of properties) {
				if (Is.empty(property.value)) {
					delete storeProperties[property.key];
				} else {
					storeProperties[property.key] = {
						type: property.type,
						value: property.value,
						isPublic: property.isPublic
					};
				}
			}

			profile.properties = storeProperties;

			await this._profileEntityStorage.set(profile);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "updateFailed", { identity }, error);
		}
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @returns Nothing.
	 */
	public async remove(identity: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (Is.empty(profile)) {
				throw new NotFoundError(this.CLASS_NAME, "notFound", identity);
			}

			await this._profileEntityStorage.remove(identity);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "removeFailed", { identity }, error);
		}
	}

	/**
	 * Get a list of the requested types.
	 * @param includePrivate Include private properties, defaults to false.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
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
	}> {
		try {
			const conditions = [];

			if (Is.arrayValue(filters)) {
				for (const filter of filters) {
					conditions.push({
						property: `properties.${filter.propertyName}.value`,
						value: filter.propertyValue,
						comparison: ComparisonOperator.Equals
					});
				}
			}

			const result = await this._profileEntityStorage.query(
				Is.arrayValue(conditions)
					? {
							conditions
						}
					: undefined,
				undefined,
				undefined,
				cursor,
				pageSize
			);

			const items: { identity: string; properties?: IIdentityProfileProperty[] }[] = [];
			const addPrivate = includePrivate ?? true;

			for (const resultEntity of result.entities) {
				const properties: IIdentityProfileProperty[] = [];
				for (const key in resultEntity.properties) {
					if (addPrivate || resultEntity.properties[key].isPublic) {
						properties.push({
							key,
							type: resultEntity.properties[key].type,
							value: resultEntity.properties[key].value,
							isPublic: resultEntity.properties[key].isPublic
						});
					}
				}

				items.push({
					identity: resultEntity.identity ?? "",
					properties: PropertyHelper.filterInclude<IIdentityProfileProperty>(
						properties,
						propertyNames
					)
				});
			}

			return {
				items,
				cursor: result.cursor,
				pageSize: result.pageSize,
				totalEntities: result.totalEntities
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "listFailed", undefined, error);
		}
	}
}

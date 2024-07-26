// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	AlreadyExistsError,
	BaseError,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	UnauthorizedError
} from "@gtsc/core";
import { ComparisonOperator, type EntityCondition } from "@gtsc/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@gtsc/entity-storage-models";
import type { IIdentityProfile, IIdentityProfileProperty } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper } from "@gtsc/schema";
import type { IServiceRequestContext } from "@gtsc/services";
import type { IdentityProfile } from "./entities/identityProfile";

/**
 * Class which implements the identity contract.
 */
export class IdentityProfileService implements IIdentityProfile {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityProfileService>();

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
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	public async create(
		identity: string,
		properties: IIdentityProfileProperty[],
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			// To create a profile the identity must match the authenticated user.
			if (requestContext?.userIdentity !== identity) {
				throw new UnauthorizedError(this.CLASS_NAME, "mismatch");
			}

			const profile = await this._profileEntityStorage.get(identity, undefined, requestContext);

			if (!Is.empty(profile)) {
				throw new AlreadyExistsError(this.CLASS_NAME, "alreadyExists", identity);
			}

			await this._profileEntityStorage.set(
				{
					identity,
					properties
				},
				requestContext
			);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "createFailed", { identity }, error);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * if matching authenticated user private properties are also returned.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param requestContext The context for the request.
	 * @returns The items properties.
	 */
	public async get(
		identity: string,
		propertyNames?: string[],
		requestContext?: IServiceRequestContext
	): Promise<{
		properties?: IIdentityProfileProperty[];
	}> {
		try {
			const profile = await this._profileEntityStorage.get(identity, undefined, requestContext);
			if (!profile) {
				throw new NotFoundError(this.CLASS_NAME, "getFailed", identity);
			}

			// If the identity matches the authenticated user, include private properties
			const includePrivate = requestContext?.userIdentity === identity;
			const props = (profile.properties ?? []).filter(p => includePrivate || p.isPublic);

			return {
				properties: PropertyHelper.filterInclude<IIdentityProfileProperty>(props, propertyNames)
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
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	public async update(
		identity: string,
		properties: IIdentityProfileProperty[],
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			// To update a profile the identity must match the authenticated user.
			if (requestContext?.userIdentity !== identity) {
				throw new UnauthorizedError(this.CLASS_NAME, "mismatch");
			}

			let profile = await this._profileEntityStorage.get(identity, undefined, requestContext);
			if (Is.empty(profile)) {
				throw new NotFoundError(this.CLASS_NAME, "notFound", identity);
			}

			const mergedProps = PropertyHelper.merge<IIdentityProfileProperty>(
				profile?.properties,
				properties
			);

			if (Is.undefined(profile)) {
				profile = {
					identity,
					properties: mergedProps
				};
			} else {
				profile.properties = mergedProps;
			}

			await this._profileEntityStorage.set(profile, requestContext);
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
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	public async remove(identity: string, requestContext?: IServiceRequestContext): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			// To remove a profile the identity must match the authenticated user.
			if (requestContext?.userIdentity !== identity) {
				throw new UnauthorizedError(this.CLASS_NAME, "mismatch");
			}

			const profile = await this._profileEntityStorage.get(identity, undefined, requestContext);
			if (Is.empty(profile)) {
				throw new NotFoundError(this.CLASS_NAME, "notFound", identity);
			}

			await this._profileEntityStorage.remove(identity, requestContext);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "removeFailed", { identity }, error);
		}
	}

	/**
	 * Get a list of the requested types.
	 * @param filters The filters to apply to the identities.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @param requestContext The context for the request.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
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
			const conditions: EntityCondition<IIdentityProfileProperty>[] = [];

			if (Is.arrayValue(filters)) {
				for (const filter of filters) {
					conditions.push({
						property: "key",
						value: filter.propertyName,
						operator: ComparisonOperator.Equals
					});
					conditions.push({
						property: "value",
						value: filter.propertyValue,
						operator: ComparisonOperator.Equals
					});
				}
			}

			const result = await this._profileEntityStorage.query(
				Is.arrayValue(conditions)
					? { property: "properties", condition: { conditions } }
					: undefined,
				undefined,
				undefined,
				cursor,
				pageSize,
				requestContext
			);

			return {
				items: result.entities.map(entity => ({
					identity: entity.identity ?? "",
					properties: PropertyHelper.filterInclude<IIdentityProfileProperty>(
						entity.properties,
						propertyNames
					)
				})),
				cursor: result.cursor,
				pageSize: result.pageSize,
				totalEntities: result.totalEntities
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "listFailed", undefined, error);
		}
	}
}

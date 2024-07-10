// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, GeneralError, Guards, NotFoundError, UnauthorizedError } from "@gtsc/core";
import { ComparisonOperator } from "@gtsc/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@gtsc/entity-storage-models";
import {
	IdentityConnectorFactory,
	IdentityRole,
	type IIdentity,
	type IIdentityConnector
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper, type IProperty } from "@gtsc/schema";
import type { IRequestContext } from "@gtsc/services";
import type { IdentityProfile } from "./entities/identityProfile";

/**
 * Class which implements the identity contract.
 */
export class IdentityService implements IIdentity {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * The identity connector.
	 * @internal
	 */
	private readonly _identityConnector: IIdentityConnector;

	/**
	 * The storage connector for the profiles.
	 * @internal
	 */
	private readonly _profileEntityStorage: IEntityStorageConnector<IdentityProfile>;

	/**
	 * Create a new instance of Identity.
	 * @param options The dependencies for the identity service.
	 * @param options.identityConnectorType The identity connector type, defaults to "identity".
	 * @param options.profileEntityStorageType The storage connector for the profiles, default to "identity-profile".
	 */
	constructor(options?: { identityConnectorType?: string; profileEntityStorageType?: string }) {
		this._identityConnector = IdentityConnectorFactory.get(
			options?.identityConnectorType ?? "identity"
		);
		this._profileEntityStorage = EntityStorageConnectorFactory.get(
			options?.profileEntityStorageType ?? "identity-profile"
		);
	}

	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param controller The controller for the identity.
	 * @param role The role for the identity.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	public async identityCreate(
		requestContext: IRequestContext,
		controller: string,
		role: IdentityRole,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.object<IRequestContext>(this.CLASS_NAME, nameof(requestContext), requestContext);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.tenantId), requestContext.tenantId);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.identity), requestContext.identity);
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.arrayOneOf(this.CLASS_NAME, nameof(role), role, Object.values(IdentityRole));

		try {
			const document = await this._identityConnector.createDocument(requestContext, controller);

			await this._profileEntityStorage.set(requestContext, {
				identity: document.id,
				role,
				properties
			});

			return {
				identity: document.id
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "identityCreateFailed", undefined, error);
		}
	}

	/**
	 * Get an item by identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async identityGet(
		requestContext: IRequestContext,
		identity: string,
		propertyNames?: string[]
	): Promise<{
		role: IdentityRole;
		properties?: IProperty[];
	}> {
		Guards.object<IRequestContext>(this.CLASS_NAME, nameof(requestContext), requestContext);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.tenantId), requestContext.tenantId);
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileEntityStorage.get(requestContext, identity);
			if (!profile) {
				throw new NotFoundError(this.CLASS_NAME, "identityGetFailed", identity);
			}

			return {
				role: profile.role,
				properties: PropertyHelper.filterInclude(profile.properties, propertyNames)
			};
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "identityGetFailed", undefined, error);
		}
	}

	/**
	 * Update an item.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async identityUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties: IProperty[]
	): Promise<void> {
		Guards.object<IRequestContext>(this.CLASS_NAME, nameof(requestContext), requestContext);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.tenantId), requestContext.tenantId);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.identity), requestContext.identity);
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			if (requestContext.identity !== identity) {
				throw new UnauthorizedError(this.CLASS_NAME, "identityMismatch");
			}

			const profile = await this._profileEntityStorage.get(requestContext, identity);
			if (!profile) {
				throw new NotFoundError(this.CLASS_NAME, "identityUpdateFailed", identity);
			}

			PropertyHelper.merge(profile.properties, properties);

			await this._profileEntityStorage.set(requestContext, profile);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "identityUpdateFailed", { identity }, error);
		}
	}

	/**
	 * Get a list of the requested types.
	 * @param requestContext The context for the request.
	 * @param role The role type to lookup.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async identityList(
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
	}> {
		Guards.object<IRequestContext>(this.CLASS_NAME, nameof(requestContext), requestContext);
		Guards.stringValue(this.CLASS_NAME, nameof(requestContext.tenantId), requestContext.tenantId);
		Guards.arrayOneOf(this.CLASS_NAME, nameof(role), role, Object.values(IdentityRole));

		try {
			const result = await this._profileEntityStorage.query(
				requestContext,
				{
					property: "role",
					value: role,
					operator: ComparisonOperator.Equals
				},
				undefined,
				undefined,
				cursor,
				pageSize
			);

			return {
				identities: result.entities.map(entity => ({
					identity: entity.identity ?? "",
					properties: PropertyHelper.filterInclude(entity.properties, propertyNames)
				})),
				cursor: result.cursor,
				pageSize: result.pageSize,
				totalEntities: result.totalEntities
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "identityListFailed", undefined, error);
		}
	}
}

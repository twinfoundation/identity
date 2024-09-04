// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, GeneralError, Guards } from "@gtsc/core";
import type { IProperty } from "@gtsc/data-core";
import {
	IdentityProfileConnectorFactory,
	type IIdentityProfileComponent,
	type IIdentityProfileConnector,
	type IIdentityProfileProperty
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";

/**
 * Class which implements the identity profile contract.
 */
export class IdentityProfileService implements IIdentityProfileComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityProfileService>();

	/**
	 * The identity profile connector.
	 * @internal
	 */
	private readonly _identityProfileConnector: IIdentityProfileConnector;

	/**
	 * Create a new instance of IdentityProfileService.
	 * @param options The dependencies for the identity profile service.
	 * @param options.profileEntityConnectorType The storage connector for the profiles, default to "identity-profile".
	 */
	constructor(options?: { profileEntityConnectorType?: string }) {
		this._identityProfileConnector = IdentityProfileConnectorFactory.get<IIdentityProfileConnector>(
			options?.profileEntityConnectorType ?? "identity-profile"
		);
	}

	/**
	 * Create the profile properties for an identity.
	 * @param properties The properties to create the profile with.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	public async create(properties: IIdentityProfileProperty[], identity?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			await this._identityProfileConnector.create(identity, properties);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "createFailed", { identity }, error);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items identity and the properties.
	 */
	public async get(
		propertyNames?: string[],
		identity?: string
	): Promise<{
		identity: string;
		properties?: IIdentityProfileProperty[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(identity, true, propertyNames);
			return {
				identity,
				properties: result.properties
			};
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "getFailed", undefined, error);
		}
	}

	/**
	 * Get the public profile properties for an identity.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items properties.
	 */
	public async getPublic(
		propertyNames: string[] | undefined,
		identity: string
	): Promise<{
		properties?: IProperty[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(identity, false, propertyNames);
			return {
				properties: (result.properties ?? []).map(property => ({
					key: property.key,
					type: property.type,
					value: property.value
				}))
			};
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "getPublicFailed", undefined, error);
		}
	}

	/**
	 * Update the profile properties of an identity.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	public async update(properties: IIdentityProfileProperty[], identity?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			await this._identityProfileConnector.update(identity, properties);
		} catch (error) {
			if (BaseError.someErrorClass(error, this.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(this.CLASS_NAME, "updateFailed", { identity }, error);
		}
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @returns Nothing.
	 */
	public async remove(identity?: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);

		try {
			await this._identityProfileConnector.remove(identity);
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
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
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
	}> {
		try {
			// We don't want to return private properties for this type of query
			// as it would expose the values to the REST api
			return this._identityProfileConnector.list(false, filters, propertyNames, cursor, pageSize);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "listFailed", undefined, error);
		}
	}
}

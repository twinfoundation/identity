// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards } from "@gtsc/core";
import { nameof } from "@gtsc/nameof";
import type { IIdentityProvider } from "../models/provider/IIdentityProvider";

/**
 * Factory for creating identity providers.
 */
export class IdentityProviderFactory {
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IdentityProviderFactory>();

	/**
	 * Store the generators.
	 * @internal
	 */
	private static readonly _generators: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[type: string]: new (...args: any[]) => IIdentityProvider;
	} = {};

	/**
	 * Store the created instances.
	 * @internal
	 */
	private static _instances: { [type: string]: IIdentityProvider } = {};

	/**
	 * Register a new identity provider.
	 * @param type The type of the identity provider.
	 * @param generator The function to create an instance.
	 */
	public static register(
		type: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		generator: new (...args: any[]) => IIdentityProvider
	): void {
		Guards.stringValue(IdentityProviderFactory._CLASS_NAME, nameof(type), type);
		Guards.function(IdentityProviderFactory._CLASS_NAME, nameof(generator), generator);
		this._generators[type] = generator;
		// Delete any existing instances if we have changed the registered item
		delete this._instances[type];
	}

	/**
	 * Unregister an identity provider.
	 * @param type The name of the identity provider to unregister.
	 * @throws GuardError if the parameters are invalid.
	 * @throws GeneralError if no provider exists.
	 */
	public static unregister(type: string): void {
		Guards.stringValue(IdentityProviderFactory._CLASS_NAME, nameof(type), type);
		if (!this._generators[type]) {
			throw new GeneralError(IdentityProviderFactory._CLASS_NAME, "noProviderUnregister", { type });
		}
		delete this._generators[type];
		delete this._instances[type];
	}

	/**
	 * Get an identity provider instance.
	 * @param type The type of the identity provider to generate.
	 * @param args To create the instance with.
	 * @returns An instance of the identity provider.
	 * @throws GuardError if the parameters are invalid.
	 * @throws GeneralError if no provider exists to get.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static get<T extends IIdentityProvider>(type: string, ...args: any[]): IIdentityProvider {
		const instance = IdentityProviderFactory.getIfExists<T>(type, args);

		if (!instance) {
			throw new GeneralError(IdentityProviderFactory._CLASS_NAME, "noProviderGet", { name: type });
		}

		return instance;
	}

	/**
	 * Get an identity provider with no exceptions.
	 * @param type The type of the identity provider to generate.
	 * @param args To create the instance with.
	 * @returns An instance of the identity provider or undefined if it does not exist.
	 */
	public static getIfExists<T extends IIdentityProvider>(
		type: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...args: any[]
	): IIdentityProvider | undefined {
		Guards.stringValue(IdentityProviderFactory._CLASS_NAME, nameof(type), type);
		if (!this._instances[type] && this._generators[type]) {
			this._instances[type] = new this._generators[type](...args);
		}
		if (this._instances[type]) {
			return this._instances[type] as T;
		}
	}

	/**
	 * Reset all the provider instances.
	 */
	public static reset(): void {
		IdentityProviderFactory._instances = {};
	}
}

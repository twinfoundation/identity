// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Is, Urn } from "@twin.org/core";
import {
	IdentityResolverConnectorFactory,
	type IIdentityResolverComponent,
	type IIdentityResolverConnector
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import type { IIdentityResolverServiceConstructorOptions } from "./models/IIdentityResolverServiceConstructorOptions";

/**
 * Class which implements the identity resolver contract.
 */
export class IdentityResolverService implements IIdentityResolverComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityResolverService>();

	/**
	 * The default namespace for the connector to use.
	 * @internal
	 */
	private readonly _defaultNamespace: string;

	/**
	 * Fallback connector type to use if the namespace connector is not available.
	 * @internal
	 */
	private readonly _fallbackResolverConnectorType: string;

	/**
	 * Create a new instance of IdentityResolverService.
	 * @param options The options for the service.
	 */
	constructor(options?: IIdentityResolverServiceConstructorOptions) {
		const names = IdentityResolverConnectorFactory.names();
		if (names.length === 0) {
			throw new GeneralError(this.CLASS_NAME, "noConnectors");
		}

		this._defaultNamespace = options?.config?.defaultNamespace ?? names[0];
		this._fallbackResolverConnectorType = options?.fallbackResolverConnectorType ?? "universal";
	}

	/**
	 * Resolve an identity.
	 * @param identity The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async identityResolve(identity: string): Promise<IDidDocument> {
		Urn.guard(this.CLASS_NAME, nameof(identity), identity);

		try {
			const identityResolverConnector = this.getConnectorByUri(identity);
			const document = await identityResolverConnector.resolveDocument(identity);

			return document;
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"identityResolveFailed",
				{
					identity
				},
				error
			);
		}
	}

	/**
	 * Get the connector from the namespace.
	 * @param namespace The namespace for the identity.
	 * @returns The connector.
	 * @internal
	 */
	private getConnectorByNamespace(namespace?: string): IIdentityResolverConnector {
		const namespaceMethod = namespace ?? this._defaultNamespace;

		let connector =
			IdentityResolverConnectorFactory.getIfExists<IIdentityResolverConnector>(namespaceMethod);

		if (Is.empty(connector)) {
			// Let's see if a fallback 'universal' connector is registered
			connector = IdentityResolverConnectorFactory.getIfExists<IIdentityResolverConnector>(
				this._fallbackResolverConnectorType
			);
			if (Is.empty(connector)) {
				throw new GeneralError(this.CLASS_NAME, "connectorNotFound", {
					namespace: namespaceMethod
				});
			}
		}

		return connector;
	}

	/**
	 * Get the connector from the uri.
	 * @param id The id of the identity in urn format.
	 * @returns The connector.
	 * @internal
	 */
	private getConnectorByUri(id: string): IIdentityResolverConnector {
		const idUri = Urn.fromValidString(id);

		if (idUri.namespaceIdentifier() !== "did") {
			throw new GeneralError(this.CLASS_NAME, "namespaceMismatch", {
				namespace: "did",
				id
			});
		}

		return this.getConnectorByNamespace(idUri.namespaceMethod());
	}
}

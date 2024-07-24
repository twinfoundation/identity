// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards } from "@gtsc/core";
import {
	IdentityConnectorFactory,
	type IIdentity,
	type IIdentityConnector
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IServiceRequestContext } from "@gtsc/services";
import type { IIdentityServiceConfig } from "./models/IIdentityServiceConfig";

/**
 * Class which implements the identity contract.
 */
export class IdentityService implements IIdentity {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * The default namespace for the connector to use.
	 * @internal
	 */
	private readonly _defaultNamespace: string;

	/**
	 * Create a new instance of IdentityService.
	 * @param config The configuration for the service.
	 */
	constructor(config?: IIdentityServiceConfig) {
		const names = IdentityConnectorFactory.names();
		if (names.length === 0) {
			throw new GeneralError(this.CLASS_NAME, "noConnectors");
		}

		this._defaultNamespace = config?.defaultNamespace ?? names[0];
	}

	/**
	 * Create a new identity.
	 * @param controller The controller for the identity.
	 * @param options Additional options for the identity service.
	 * @param options.namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @param requestContext The context for the request.
	 * @returns The created identity details.
	 */
	public async create(
		controller: string,
		options?: {
			namespace?: string;
		},
		requestContext?: IServiceRequestContext
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const connectorNamespace = options?.namespace ?? this._defaultNamespace;

			const identityConnector =
				IdentityConnectorFactory.get<IIdentityConnector>(connectorNamespace);

			const document = await identityConnector.createDocument(controller, requestContext);

			return {
				identity: document.id
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createFailed", undefined, error);
		}
	}
}

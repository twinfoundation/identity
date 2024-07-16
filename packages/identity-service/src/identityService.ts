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
	 * Create a new instance of Identity.
	 * @param options The dependencies for the identity service.
	 * @param options.identityConnectorType The identity connector type, defaults to "identity".
	 */
	constructor(options?: { identityConnectorType?: string }) {
		this._identityConnector = IdentityConnectorFactory.get(
			options?.identityConnectorType ?? "identity"
		);
	}

	/**
	 * Create a new identity.
	 * @param controller The controller for the identity.
	 * @param requestContext The context for the request.
	 * @returns The created identity details.
	 */
	public async create(
		controller: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const document = await this._identityConnector.createDocument(controller, requestContext);

			return {
				identity: document.id
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createFailed", undefined, error);
		}
	}
}

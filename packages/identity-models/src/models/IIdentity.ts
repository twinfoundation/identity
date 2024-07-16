// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IService, IServiceRequestContext } from "@gtsc/services";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentity extends IService {
	/**
	 * Create a new identity.
	 * @param controller The controller for the identity.
	 * @param requestContext The context for the request.
	 * @returns The created identity details.
	 */
	create(
		controller: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}>;
}

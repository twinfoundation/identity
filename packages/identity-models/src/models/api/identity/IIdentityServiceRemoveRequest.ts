// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to remove a service.
 */
export interface IIdentityServiceRemoveRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to remove the service from.
		 */
		identity: string;

		/**
		 * The service to remove.
		 */
		serviceId: string;
	};
}

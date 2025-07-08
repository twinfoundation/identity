// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to create a service.
 */
export interface IIdentityServiceCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the service for.
		 */
		identity: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The id of the service.
		 */
		serviceId: string;

		/**
		 * The type of the service.
		 */
		type: string | string[];

		/**
		 * The endpoint for the service.
		 */
		endpoint: string | string[];
	};
}

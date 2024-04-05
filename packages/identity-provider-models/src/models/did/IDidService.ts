// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing a did document service.
 */
export interface IDidService {
	/**
	 * The id of the service.
	 */
	id: string;

	/**
	 * The type of the service.
	 */
	type: string | string[];

	/**
	 * The endpoint for the service.
	 */
	serviceEndpoint: string | string[];
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing objects created by gas station transactions.
 */
export interface IGasStationCreatedObject {
	/**
	 * Owner information for the created object.
	 */
	owner?: {
		/**
		 * Shared object indicator.
		 */
		Shared?: unknown;
		/**
		 * Address owner for the object.
		 */
		AddressOwner?: string;
	};
	/**
	 * Reference information for the created object.
	 */
	reference?: {
		/**
		 * Object ID of the created object.
		 */
		objectId?: string;
		/**
		 * Version of the object.
		 */
		version?: number;
		/**
		 * Digest of the object.
		 */
		digest?: string;
	};
}

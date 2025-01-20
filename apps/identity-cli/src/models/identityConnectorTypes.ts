// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The identity connector types.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityConnectorTypes = {
	/**
	 * IOTA.
	 */
	Iota: "iota",

	/**
	 * IOTA Rebased.
	 */
	IotaRebased: "iota-rebased"
} as const;

/**
 * The identity connector types.
 */
export type IdentityConnectorTypes =
	(typeof IdentityConnectorTypes)[keyof typeof IdentityConnectorTypes];

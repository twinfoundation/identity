// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The identity resolver connector types.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityResolverConnectorTypes = {
	/**
	 * IOTA.
	 */
	Iota: "iota",

	/**
	 * IOTA Stardust.
	 */
	IotaStardust: "iota-stardust"
} as const;

/**
 * The identity resolver connector types.
 */
export type IdentityResolverConnectorTypes =
	(typeof IdentityResolverConnectorTypes)[keyof typeof IdentityResolverConnectorTypes];

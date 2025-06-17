// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { TransactionBuilder, CreateIdentity } from "@iota/identity-wasm/node/index.js";

/**
 * Interface describing an identity builder that can be finished to create a transaction.
 */
export interface IIdentityBuilder {
	/**
	 * Finish the identity builder.
	 * @returns The finished transaction builder.
	 */
	finish(): TransactionBuilder<CreateIdentity>;
}

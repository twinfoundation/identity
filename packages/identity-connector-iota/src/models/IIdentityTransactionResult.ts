// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { TransactionOutput, CreateIdentity } from "@iota/identity-wasm/node/index.js";

/**
 * Type describing the result of an identity transaction execution.
 */
export type IIdentityTransactionResult = TransactionOutput<CreateIdentity>;

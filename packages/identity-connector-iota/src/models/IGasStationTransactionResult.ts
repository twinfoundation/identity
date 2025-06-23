// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IGasStationCreatedObject } from "./IGasStationCreatedObject";

/**
 * Interface describing the structure of gas station transaction results.
 * Gas station transactions return a different structure than regular TransactionOutput.
 */
export interface IGasStationTransactionResult {
	/**
	 * Transaction effects from gas station transaction result (top-level).
	 */
	effects?: {
		/**
		 * Objects created by the transaction.
		 */
		created?: IGasStationCreatedObject[];
	};
}

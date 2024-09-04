// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProperty } from "@gtsc/data-core";

/**
 * Interface describing a contract which provides profile operations.
 */
export interface IIdentityProfileProperty extends IProperty {
	/**
	 * Is the property public.
	 */
	isPublic: boolean;
}

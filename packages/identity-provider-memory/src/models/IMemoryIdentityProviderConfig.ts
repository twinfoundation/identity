// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@gtsc/identity-provider-models";

/**
 * Configuration for the Memory Identity Provider.
 */
export interface IMemoryIdentityProviderConfig {
	/**
	 * Initial values to populate the identities with.
	 */
	initialValues?: { [id: string]: IDidDocument };
}

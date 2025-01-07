// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@twin.org/standards-w3c-did";

/**
 * Response to resolving an identity.
 */
export interface IIdentityResolveResponse {
	/**
	 * The response payload.
	 */
	body: IDidDocument;
}

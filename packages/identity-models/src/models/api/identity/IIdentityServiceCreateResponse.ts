// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidService } from "@twin.org/standards-w3c-did";

/**
 * Response to creating a service.
 */
export interface IIdentityServiceCreateResponse {
	/**
	 * The response payload.
	 */
	body: IDidService;
}

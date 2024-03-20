// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { FactoryInstance } from "@gtsc/core";
import type { IIdentityProvider } from "../models/provider/IIdentityProvider";

/**
 * Factory for creating identity providers.
 */
export class IdentityProviderFactory {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public static readonly Instance: FactoryInstance<IIdentityProvider> =
		new FactoryInstance<IIdentityProvider>("identityProvider");
}

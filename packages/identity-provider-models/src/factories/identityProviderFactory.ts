// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@gtsc/core";
import type { IIdentityProvider } from "../models/IIdentityProvider";

/**
 * Factory for creating identity providers.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityProviderFactory = new Factory<IIdentityProvider>("identityProvider");

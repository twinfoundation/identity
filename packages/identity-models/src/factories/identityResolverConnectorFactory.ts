// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@twin.org/core";
import type { IIdentityResolverConnector } from "../models/IIdentityResolverConnector";

/**
 * Factory for creating identity resolver connectors.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityResolverConnectorFactory = Factory.createFactory<IIdentityResolverConnector>(
	"identity-resolver-connector"
);

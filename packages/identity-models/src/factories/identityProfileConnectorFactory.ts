// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@twin.org/core";
import type { IIdentityProfileConnector } from "../models/IIdentityProfileConnector";

/**
 * Factory for creating identity profile connectors.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityProfileConnectorFactory = Factory.createFactory<IIdentityProfileConnector>(
	"identity-profile-connector"
);

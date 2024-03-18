// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IEntityDescriptor } from "@gtsc/entity";
import type { IIdentityProfile } from "./IIdentityProfile";

/**
 * Entity description for a IIdentityProfile.
 * @returns The descriptor for the IIdentityProfile.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IIdentityProfileDescriptor: IEntityDescriptor<IIdentityProfile> = {
	properties: [
		{
			name: "identity",
			type: "string",
			isPrimary: true
		},
		{
			name: "emailAddress",
			type: "string",
			isSecondary: true
		},
		{
			name: "imageBlobId",
			type: "string",
			optional: true
		},
		{
			name: "properties",
			type: "object",
			optional: true
		},
		{
			name: "keyIndexes",
			type: "object",
			optional: true
		},
		{
			name: "verifiableCredentials",
			type: "object",
			optional: true
		}
	]
};

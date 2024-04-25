// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityDescriptor } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import type { IProperty } from "@gtsc/schema";
import type { IIdentityProfile } from "./IIdentityProfile";
import type { IIdentityProfileVerifiableCredentialStatus } from "./IIdentityProfileVerifiableCredentialStatus";

/**
 * Entity description for a IIdentityProfile.
 * @returns The descriptor for the IIdentityProfile.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IIdentityProfileDescriptor: IEntityDescriptor<IIdentityProfile> = {
	name: nameof<IIdentityProfile>(),
	properties: [
		{
			name: "identity",
			type: "string",
			isPrimary: true
		},
		{
			name: "role",
			type: "string",
			isSecondary: true
		},
		{
			name: "properties",
			type: "list",
			itemType: nameof<IProperty>(),
			optional: true
		},
		{
			name: "keyIndexes",
			type: "object",
			optional: true
		},
		{
			name: "verifiableCredentials",
			type: "list",
			itemType: nameof<IIdentityProfileVerifiableCredentialStatus>(),
			optional: true
		},
		{
			name: "nextRevocationIndex",
			type: "string",
			optional: true
		}
	]
};

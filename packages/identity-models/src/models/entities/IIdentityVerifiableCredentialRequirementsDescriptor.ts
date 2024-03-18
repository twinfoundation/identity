// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type { IEntityDescriptor } from "@gtsc/entity";
import type { IIdentityVerifiableCredentialRequirements } from "./IIdentityVerifiableCredentialRequirements";

/**
 * Entity description for a IIdentityVerifiableCredentialRequirements.
 * @returns The descriptor for the IIdentityVerifiableCredentialRequirements.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention, max-len
export const IIdentityVerifiableCredentialRequirementsDescriptor: IEntityDescriptor<IIdentityVerifiableCredentialRequirements> =
	{
		properties: [
			{
				name: "identity",
				type: "string",
				isPrimary: true
			},
			{
				name: "verifiableCredentialType",
				type: "string",
				isSecondary: true
			},
			{
				name: "matchDomains",
				type: "string",
				optional: true
			},
			{
				name: "requiredClaims",
				type: "object",
				optional: true
			}
		]
	};

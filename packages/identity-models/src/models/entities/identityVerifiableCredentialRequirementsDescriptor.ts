// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityDescriptor } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import type { IIdentityVerifiableCredentialRequirements } from "./IIdentityVerifiableCredentialRequirements";

/**
 * Entity description for a IIdentityVerifiableCredentialRequirements.
 * @returns The descriptor for the IIdentityVerifiableCredentialRequirements.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention, max-len
export const IdentityVerifiableCredentialRequirementsDescriptor: IEntityDescriptor<IIdentityVerifiableCredentialRequirements> =
	{
		name: nameof<IIdentityVerifiableCredentialRequirements>(),
		properties: [
			{
				property: "identity",
				type: "string",
				isPrimary: true
			},
			{
				property: "verifiableCredentialType",
				type: "string",
				isSecondary: true
			},
			{
				property: "requiredClaims",
				type: "object",
				optional: true
			}
		]
	};

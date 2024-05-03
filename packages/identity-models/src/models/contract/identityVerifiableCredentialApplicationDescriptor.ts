// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityDescriptor } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import type { IIdentityVerifiableCredentialApplication } from "./IIdentityVerifiableCredentialApplication";

/**
 * Entity description for a IIdentityVerifiableCredentialApplication.
 * @returns The descriptor for the IIdentityVerifiableCredentialApplication.
 */
// eslint-disable-next-line max-len, @typescript-eslint/naming-convention
export const IdentityVerifiableCredentialApplicationDescriptor: IEntityDescriptor<IIdentityVerifiableCredentialApplication> =
	{
		name: nameof<IIdentityVerifiableCredentialApplication>(),
		properties: [
			{
				property: "id",
				type: "string",
				isPrimary: true
			},
			{
				property: "issuer",
				type: "string",
				isSecondary: true
			},
			{
				property: "subject",
				type: "string",
				isSecondary: true
			},
			{
				property: "state",
				type: "string",
				isSecondary: true
			},
			{
				property: "created",
				type: "timestamp"
			},
			{
				property: "updated",
				type: "timestamp"
			},
			{
				property: "verifiableCredentialType",
				type: "string",
				isSecondary: true
			},
			{
				property: "privateClaims",
				type: "object",
				optional: true
			},
			{
				property: "publicClaims",
				type: "object",
				optional: true
			},
			{
				property: "verifiableCredential",
				type: "object",
				optional: true
			},
			{
				property: "rejectedCode",
				type: "string",
				optional: true
			}
		]
	};

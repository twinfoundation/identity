// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityDescriptor } from "@gtsc/entity";
import type { IIdentityVerifiableCredentialApplication } from "./IIdentityVerifiableCredentialApplication";

/**
 * Entity description for a IIdentityVerifiableCredentialApplication.
 * @returns The descriptor for the IIdentityVerifiableCredentialApplication.
 */
// eslint-disable-next-line max-len, @typescript-eslint/naming-convention
export const IIdentityVerifiableCredentialApplicationDescriptor: IEntityDescriptor<IIdentityVerifiableCredentialApplication> =
	{
		properties: [
			{
				name: "id",
				type: "string",
				isPrimary: true
			},
			{
				name: "issuer",
				type: "string",
				isSecondary: true
			},
			{
				name: "subject",
				type: "string",
				isSecondary: true
			},
			{
				name: "state",
				type: "string",
				isSecondary: true
			},
			{
				name: "created",
				type: "timestamp"
			},
			{
				name: "updated",
				type: "timestamp"
			},
			{
				name: "verifiableCredentialType",
				type: "string",
				isSecondary: true
			},
			{
				name: "privateClaims",
				type: "object",
				optional: true
			},
			{
				name: "publicClaims",
				type: "object",
				optional: true
			},
			{
				name: "verifiableCredential",
				type: "object",
				optional: true
			},
			{
				name: "rejectedCode",
				type: "string",
				optional: true
			}
		]
	};

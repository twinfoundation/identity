// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityDescriptor } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import type { IIdentityDocument } from "./IIdentityDocument";

/**
 * Entity description for a IIdentityDocument.
 * @returns The descriptor for the IIdentityDocument.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityDocumentDescriptor: IEntityDescriptor<IIdentityDocument> = {
	name: nameof<IIdentityDocument>(),
	properties: [
		{
			property: "id",
			type: "string",
			isPrimary: true
		},
		{
			property: "document",
			type: "string"
		}
	]
};

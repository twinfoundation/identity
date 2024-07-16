// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import { IdentityDocument } from "./entities/identityDocument";

/**
 * Initialize the schema for the identity entity storage connector.
 */
export function initSchema(): void {
	EntitySchemaFactory.register(nameof(IdentityDocument), () =>
		EntitySchemaHelper.getSchema(IdentityDocument)
	);
}

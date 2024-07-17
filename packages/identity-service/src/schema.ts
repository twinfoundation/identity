// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@gtsc/entity";
import { nameof } from "@gtsc/nameof";
import { IdentityProfile } from "./entities/identityProfile";

/**
 * Initialize the schema for the identity service.
 */
export function initSchema(): void {
	EntitySchemaFactory.register(nameof<IdentityProfile>(), () =>
		EntitySchemaHelper.getSchema(IdentityProfile)
	);
}

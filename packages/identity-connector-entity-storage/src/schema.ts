// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@twin.org/entity";
import { nameof } from "@twin.org/nameof";
import { IdentityDocument } from "./entities/identityDocument";
import { IdentityProfile } from "./entities/identityProfile";

/**
 * Initialize the schema for the identity entity storage connector.
 * @param options Options for which entities to register.
 * @param options.includeDocument Whether to include the document entity, defaults to true.
 * @param options.includeProfile Whether to include the profile entity, defaults to true.
 */
export function initSchema(options?: {
	includeDocument?: boolean;
	includeProfile?: boolean;
}): void {
	if (options?.includeDocument ?? true) {
		EntitySchemaFactory.register(nameof(IdentityDocument), () =>
			EntitySchemaHelper.getSchema(IdentityDocument)
		);
	}
	if (options?.includeProfile ?? true) {
		EntitySchemaFactory.register(nameof<IdentityProfile>(), () =>
			EntitySchemaHelper.getSchema(IdentityProfile)
		);
	}
}

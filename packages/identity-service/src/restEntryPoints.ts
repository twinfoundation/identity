// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@twin.org/api-models";
import { generateRestRoutesIdentityProfile, tagsIdentityProfile } from "./identityProfileRoutes";
import { generateRestRoutesIdentityResolver, tagsIdentityResolver } from "./identityResolverRoutes";
import { generateRestRoutesIdentity, tagsIdentity } from "./identityRoutes";

export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "identityResolver",
		defaultBaseRoute: "identity",
		tags: tagsIdentityResolver,
		generateRoutes: generateRestRoutesIdentityResolver
	},
	{
		name: "identity",
		defaultBaseRoute: "identity",
		tags: tagsIdentity,
		generateRoutes: generateRestRoutesIdentity
	},
	{
		name: "identityProfile",
		defaultBaseRoute: "identity/profile",
		tags: tagsIdentityProfile,
		generateRoutes: generateRestRoutesIdentityProfile
	}
];

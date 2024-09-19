// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@twin.org/api-models";
import { generateRestRoutesIdentityProfile, tagsIdentityProfile } from "./identityProfileRoutes";
import { generateRestRoutesIdentity, tagsIdentity } from "./identityRoutes";

export const restEntryPoints: IRestRouteEntryPoint[] = [
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

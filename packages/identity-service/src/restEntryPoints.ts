// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@gtsc/api-models";
import { generateRestRoutesIdentityProfile, tagsIdentityProfile } from "./identityProfileRoutes";
import { generateRestRoutesIdentity, tagsIdentity } from "./identityRoutes";

export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "identity",
		tags: tagsIdentity,
		generateRoutes: generateRestRoutesIdentity
	},
	{
		name: "identityProfile",
		tags: tagsIdentityProfile,
		generateRoutes: generateRestRoutesIdentityProfile
	}
];

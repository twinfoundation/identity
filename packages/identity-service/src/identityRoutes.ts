// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRoute, ITag } from "@twin.org/api-models";

/**
 * The source used when communicating about these routes.
 */
// const ROUTES_SOURCE = "identityRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsIdentity: ITag[] = [
	{
		name: "Identity",
		description: "Service to provide all features related to digital identity."
	}
];

/**
 * The REST routes for identity.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesIdentity(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	return [];
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IHttpRequestContext, IRestRoute, ITag } from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import type {
	IIdentityComponent,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "identityRoutes";

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
	const identityResolveRoute: IRestRoute<IIdentityResolveRequest, IIdentityResolveResponse> = {
		operationId: "identityResolve",
		summary: "Resolve an identity",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/:id`,
		handler: async (httpRequestContext, request) =>
			identityResolve(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityResolveRequest>(),
			examples: [
				{
					id: "identityResolveRequestExample",
					request: {
						pathParams: {
							id: "did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityResolveResponse>(),
				examples: [
					{
						id: "identityResolveResponseExample",
						response: {
							body: {
								id: "did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a",
								service: [
									{
										id: "did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a#revocation",
										type: "RevocationBitmap2022",
										serviceEndpoint: "data:application/octet-stream;base64,eJyzMmAAAwABr"
									}
								]
							}
						}
					}
				]
			}
		],
		skipAuth: true
	};

	return [identityResolveRoute];
}

/**
 * Resolve an identity.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityResolve(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityResolveRequest
): Promise<IIdentityResolveResponse> {
	Guards.object<IIdentityResolveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityResolveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.identityResolve(request.pathParams.id);

	return {
		body: result
	};
}

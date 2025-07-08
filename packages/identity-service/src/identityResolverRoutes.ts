// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IHttpRequestContext, IRestRoute, ITag } from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import type {
	IIdentityResolverComponent,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import { DidContexts } from "@twin.org/standards-w3c-did";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "identityResolverRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsIdentityResolver: ITag[] = [
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
export function generateRestRoutesIdentityResolver(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const identityResolveRoute: IRestRoute<IIdentityResolveRequest, IIdentityResolveResponse> = {
		operationId: "identityResolve",
		summary: "Resolve an identity",
		tag: tagsIdentityResolver[0].name,
		method: "GET",
		path: `${baseRouteName}/:identity`,
		handler: async (httpRequestContext, request) =>
			identityResolve(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityResolveRequest>(),
			examples: [
				{
					id: "identityResolveRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a"
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
								"@context": DidContexts.Context,
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
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const component = ComponentFactory.get<IIdentityResolverComponent>(componentName);

	const result = await component.identityResolve(request.pathParams.identity);

	return {
		body: result
	};
}

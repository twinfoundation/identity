// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IHttpRequestContext, IRestRoute, ITag } from "@gtsc/api-models";
import { Guards } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { ServiceFactory } from "@gtsc/services";

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
 * @param serviceName The name of the service to use in the routes.
 * @returns The generated routes.
 */
export function generateRestRoutesIdentity(
	baseRouteName: string,
	serviceName: string
): IRestRoute[] {
	const identityResolveRoute: IRestRoute<IIdentityResolveRequest, IIdentityResolveResponse> = {
		operationId: "identityResolve",
		summary: "Resolve an identity",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/:id`,
		handler: async (requestContext, request) =>
			identityResolve(requestContext, serviceName, request),
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
		]
	};

	return [identityResolveRoute];
}

/**
 * Resolve an identity.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityResolve(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityResolveRequest
): Promise<IIdentityResolveResponse> {
	Guards.object<IIdentityResolveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityResolveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);

	const service = ServiceFactory.get<IIdentity>(serviceName);

	const result = await service.resolve(request.pathParams.id);

	return {
		body: result
	};
}

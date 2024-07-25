// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ICreatedResponse, IHttpRequestContext, IRestRoute, ITag } from "@gtsc/api-models";
import { Guards } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityCreateRequest,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { ServiceFactory } from "@gtsc/services";
import { HttpStatusCode } from "@gtsc/web";

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
	const identityCreateRoute: IRestRoute<IIdentityCreateRequest, ICreatedResponse> = {
		operationId: "identityCreate",
		summary: "Create a new identity",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/`,
		handler: async (requestContext, request) =>
			identityCreate(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityCreateRequest>(),
			examples: [
				{
					id: "identityCreateRequestExample",
					request: {
						body: {
							controller: "tst1qrtks2qycm4al8lqw4wxxcvz8sdsrkf7xdxlvgtpcf8ve8gwzsvux44jd7n"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<ICreatedResponse>(),
				examples: [
					{
						id: "identityCreateResponseExample",
						response: {
							statusCode: HttpStatusCode.created,
							headers: {
								location:
									"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
							}
						}
					}
				]
			}
		]
	};

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

	return [identityCreateRoute, identityResolveRoute];
}

/**
 * Create a new identity.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityCreate(
	requestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityCreateRequest
): Promise<ICreatedResponse> {
	Guards.object<IIdentityCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityCreateRequest["body"]>(ROUTES_SOURCE, nameof(request.body), request.body);

	const service = ServiceFactory.get<IIdentity>(serviceName);

	const result = await service.create(
		request.body.controller,
		{
			namespace: request.body.namespace
		},
		requestContext
	);

	return {
		statusCode: HttpStatusCode.created,
		headers: {
			location: result.identity
		}
	};
}

/**
 * Resolve an identity.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityResolve(
	requestContext: IHttpRequestContext,
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

	const result = await service.resolve(request.pathParams.id, requestContext);

	return {
		body: result
	};
}

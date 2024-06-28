// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type {
	ICreatedResponse,
	INoContentResponse,
	INotFoundResponse,
	IRestRoute,
	ITag
} from "@gtsc/api-models";
import { Coerce, Guards } from "@gtsc/core";
import {
	IdentityRole,
	type IIdentity,
	type IIdentityCreateRequest,
	type IIdentityGetRequest,
	type IIdentityGetResponse,
	type IIdentityListRequest,
	type IIdentityListResponse,
	type IIdentityUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { ServiceFactory, type IRequestContext } from "@gtsc/services";
import { HttpStatusCodes } from "@gtsc/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "identityRoutes";

/**
 * The tag to associate with the routes.
 */
export const tags: ITag[] = [
	{
		name: "Identity",
		description: "Service to provide all features related to digital identity."
	}
];

/**
 * The REST routes for identity.
 * @param routeName Prefix to prepend to the paths.
 * @param serviceName The name of the service to use in the routes.
 * @returns The generated routes.
 */
export function generateRestRoutes(routeName: string, serviceName: string): IRestRoute[] {
	const identityCreateRoute: IRestRoute<IIdentityCreateRequest, ICreatedResponse> = {
		operationId: "identityCreate",
		summary: "Create a new identity",
		tag: tags[0].name,
		method: "POST",
		path: `${routeName}/`,
		handler: async (requestContext, request) =>
			identityCreate(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityCreateRequest>(),
			examples: [
				{
					id: "identityCreateRequestExample",
					request: {
						body: {
							controller: "tst1qrtks2qycm4al8lqw4wxxcvz8sdsrkf7xdxlvgtpcf8ve8gwzsvux44jd7n",
							role: IdentityRole.User,
							properties: [
								{
									key: "email",
									type: "https://schema.org/Text",
									value: "john@example.com"
								},
								{
									key: "name",
									type: "https://schema.org/Text",
									value: "John Doe"
								}
							]
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
							statusCode: HttpStatusCodes.CREATED,
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

	const identityUpdateRoute: IRestRoute<IIdentityUpdateRequest, void> = {
		operationId: "identityUpdate",
		summary: "Update an identity",
		tag: tags[0].name,
		method: "PUT",
		path: `${routeName}/:identity`,
		handler: async (requestContext, request) =>
			identityUpdate(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityUpdateRequest>(),
			examples: [
				{
					id: "identityUpdateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						body: {
							properties: [
								{
									key: "email",
									type: "https://schema.org/Text",
									value: "john@example.com"
								},
								{
									key: "name",
									type: "https://schema.org/Text",
									value: "John Smith"
								}
							]
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityGetRoute: IRestRoute<IIdentityGetRequest, IIdentityGetResponse> = {
		operationId: "identityGet",
		summary: "Get the identity details",
		tag: tags[0].name,
		method: "GET",
		path: `${routeName}/:identity`,
		handler: async (requestContext, request) => identityGet(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityGetRequest>(),
			examples: [
				{
					id: "identityGetRequestExample",
					request: {
						pathParams: {
							identity:
								"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						query: {
							propertyNames: "email,name"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityGetResponse>(),
				examples: [
					{
						id: "identityGetResponseExample",
						response: {
							body: {
								role: IdentityRole.User,
								properties: [
									{
										key: "email",
										type: "https://schema.org/Text",
										value: "john@example.com"
									},
									{
										key: "name",
										type: "https://schema.org/Text",
										value: "John Does"
									}
								]
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityListRoute: IRestRoute<IIdentityListRequest, IIdentityListResponse> = {
		operationId: "identitiesList",
		summary: "Get the list of identities based on the provided criteria",
		tag: tags[0].name,
		method: "GET",
		path: `${routeName}/`,
		handler: async (requestContext, request) =>
			identitiesList(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityListRequest>(),
			examples: [
				{
					id: "identityListRequestExample",
					request: {
						query: {
							role: IdentityRole.User
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityListResponse>(),
				examples: [
					{
						id: "identitiesListResponseExample",
						response: {
							body: {
								identities: [
									{
										identity:
											"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
										properties: [
											{
												key: "email",
												type: "https://schema.org/Text",
												value: "john@example.com"
											}
										]
									}
								],
								cursor: "1",
								pageSize: 10,
								totalEntities: 20
							}
						}
					}
				]
			}
		]
	};

	return [identityCreateRoute, identityUpdateRoute, identityGetRoute, identityListRoute];
}

/**
 * Create a new identity.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @param body The body if required for pure content.
 * @returns The response object with additional http response properties.
 */
export async function identityCreate(
	requestContext: IRequestContext,
	serviceName: string,
	request: IIdentityCreateRequest,
	body?: unknown
): Promise<ICreatedResponse> {
	Guards.object<IIdentityCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityCreateRequest["body"]>(ROUTES_SOURCE, nameof(request.body), request.body);

	const service = ServiceFactory.get<IIdentity>(serviceName);

	const result = await service.identityCreate(
		requestContext,
		request.body.controller,
		request.body.role,
		request.body.properties
	);

	return {
		statusCode: HttpStatusCodes.CREATED,
		headers: {
			location: result.identity
		}
	};
}

/**
 * Update an identity.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @param body The body if required for pure content.
 * @returns The response object with additional http response properties.
 */
export async function identityUpdate(
	requestContext: IRequestContext,
	serviceName: string,
	request: IIdentityUpdateRequest,
	body?: unknown
): Promise<void> {
	Guards.object<IIdentityUpdateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityUpdateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.object<IIdentityUpdateRequest["body"]>(ROUTES_SOURCE, nameof(request.body), request.body);
	const service = ServiceFactory.get<IIdentity>(serviceName);

	await service.identityUpdate(
		requestContext,
		request.pathParams.identity,
		request.body.properties
	);
}

/**
 * Get the identity details.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @param body The body if required for pure content.
 * @returns The response object with additional http response properties.
 */
export async function identityGet(
	requestContext: IRequestContext,
	serviceName: string,
	request: IIdentityGetRequest,
	body?: unknown
): Promise<IIdentityGetResponse> {
	Guards.object<IIdentityGetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityGetRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const service = ServiceFactory.get<IIdentity>(serviceName);

	const result = await service.identityGet(
		requestContext,
		request.pathParams.identity,
		request?.query?.propertyNames?.split(",")
	);

	return {
		body: {
			role: result.role,
			properties: result.properties
		}
	};
}

/**
 * Get the list of organizations.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @param body The body if required for pure content.
 * @returns The response object with additional http response properties.
 */
export async function identitiesList(
	requestContext: IRequestContext,
	serviceName: string,
	request: IIdentityListRequest,
	body?: unknown
): Promise<IIdentityListResponse> {
	const service = ServiceFactory.get<IIdentity>(serviceName);

	return {
		body: await service.identityList(
			requestContext,
			request?.query?.role,
			request?.query?.propertyNames?.split(","),
			request?.query?.cursor,
			Coerce.number(request.query?.pageSize)
		)
	};
}

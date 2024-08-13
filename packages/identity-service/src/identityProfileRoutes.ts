// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IConflictResponse,
	IHttpRequestContext,
	INoContentRequest,
	INoContentResponse,
	INotFoundResponse,
	IRestRoute,
	ITag
} from "@gtsc/api-models";
import { Coerce, Guards } from "@gtsc/core";
import type {
	IIdentityProfile,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileCreateRequest,
	IIdentityProfileUpdateRequest,
	IIdentityProfileGetPublicRequest,
	IIdentityProfileGetPublicResponse
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { ServiceFactory } from "@gtsc/services";
import { HttpStatusCode } from "@gtsc/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "identityProfileRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsIdentityProfile: ITag[] = [
	{
		name: "Identity Profile",
		description: "Service to provide all features related to digital identity profiles."
	}
];

/**
 * The REST routes for identity.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param serviceName The name of the service to use in the routes.
 * @returns The generated routes.
 */
export function generateRestRoutesIdentityProfile(
	baseRouteName: string,
	serviceName: string
): IRestRoute[] {
	const identityProfileCreateRoute: IRestRoute<IIdentityProfileCreateRequest, INoContentResponse> =
		{
			operationId: "identityProfileCreate",
			summary: "Create an identity profile",
			tag: tagsIdentityProfile[0].name,
			method: "POST",
			path: `${baseRouteName}/`,
			handler: async (httpRequestContext, request) =>
				identityProfileCreate(httpRequestContext, serviceName, request),
			requestType: {
				type: nameof<IIdentityProfileCreateRequest>(),
				examples: [
					{
						id: "identityProfileCreateRequestExample",
						request: {
							body: {
								properties: [
									{
										key: "role",
										type: "https://schema.org/Text",
										value: "User",
										isPublic: false
									},
									{
										key: "email",
										type: "https://schema.org/Text",
										value: "john@example.com",
										isPublic: false
									},
									{
										key: "name",
										type: "https://schema.org/Text",
										value: "John Smith",
										isPublic: true
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
					type: nameof<IConflictResponse>()
				}
			]
		};

	const identityProfileGetRoute: IRestRoute<
		IIdentityProfileGetRequest,
		IIdentityProfileGetResponse
	> = {
		operationId: "identityProfileGet",
		summary: "Get the identity profile properties",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			identityGet(httpRequestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityProfileGetRequest>(),
			examples: [
				{
					id: "identityGetProfileRequestExample",
					request: {
						query: {
							propertyNames: "role,email,name"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileGetResponse>(),
				examples: [
					{
						id: "identityGetResponseExample",
						response: {
							body: {
								identity:
									"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
								properties: [
									{
										key: "role",
										type: "https://schema.org/Text",
										value: "User",
										isPublic: false
									},
									{
										key: "email",
										type: "https://schema.org/Text",
										value: "john@example.com",
										isPublic: false
									},
									{
										key: "name",
										type: "https://schema.org/Text",
										value: "John Smith",
										isPublic: true
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

	const identityProfileGetPublicRoute: IRestRoute<
		IIdentityProfileGetPublicRequest,
		IIdentityProfileGetPublicResponse
	> = {
		operationId: "identityProfileGetPublic",
		summary: "Get the identity profile public properties",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/:identity/public`,
		handler: async (httpRequestContext, request) =>
			identityGetPublic(httpRequestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityProfileGetPublicRequest>(),
			examples: [
				{
					id: "identityGetPublicProfileRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						query: {
							propertyNames: "role,email,name"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileGetPublicResponse>(),
				examples: [
					{
						id: "identityGetPublicResponseExample",
						response: {
							body: {
								properties: [
									{
										key: "role",
										type: "https://schema.org/Text",
										value: "User"
									},
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
			{
				type: nameof<INotFoundResponse>()
			}
		],
		skipAuth: true
	};

	const identityProfileUpdateRoute: IRestRoute<IIdentityProfileUpdateRequest, INoContentResponse> =
		{
			operationId: "identityProfileUpdate",
			summary: "Update an identity profile properties",
			tag: tagsIdentityProfile[0].name,
			method: "PUT",
			path: `${baseRouteName}/`,
			handler: async (httpRequestContext, request) =>
				identityProfileUpdate(httpRequestContext, serviceName, request),
			requestType: {
				type: nameof<IIdentityProfileUpdateRequest>(),
				examples: [
					{
						id: "identityProfileUpdateRequestExample",
						request: {
							body: {
								properties: [
									{
										key: "role",
										type: "https://schema.org/Text",
										value: "User",
										isPublic: false
									},
									{
										key: "email",
										type: "https://schema.org/Text",
										value: undefined,
										isPublic: false
									},
									{
										key: "name",
										type: "https://schema.org/Text",
										value: "John Smith",
										isPublic: true
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

	const identityProfileRemoveRoute: IRestRoute<INoContentRequest, INoContentResponse> = {
		operationId: "identityProfileRemove",
		summary: "Remove an identity profile",
		tag: tagsIdentityProfile[0].name,
		method: "DELETE",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			identityProfileRemove(httpRequestContext, serviceName, request),
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityProfileListRoute: IRestRoute<
		IIdentityProfileListRequest,
		IIdentityProfileListResponse
	> = {
		operationId: "identitiesProfileList",
		summary: "Get the list of profile data for identities",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/query/`,
		handler: async (httpRequestContext, request) =>
			identitiesList(httpRequestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityProfileListRequest>(),
			examples: [
				{
					id: "identityProfileListRequestExample",
					request: {
						query: {}
					}
				},
				{
					id: "identityProfileListRequestFilteredExample",
					request: {
						query: {
							filters: "role:User"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileListResponse>(),
				examples: [
					{
						id: "identitiesProfileListResponseExample",
						response: {
							body: {
								items: [
									{
										identity:
											"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
										properties: [
											{
												key: "email",
												type: "https://schema.org/Text",
												value: "john@example.com",
												isPublic: false
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

	return [
		identityProfileCreateRoute,
		identityProfileGetRoute,
		identityProfileGetPublicRoute,
		identityProfileUpdateRoute,
		identityProfileRemoveRoute,
		identityProfileListRoute
	];
}

/**
 * Create an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileCreate(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileCreateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	await service.create(request.body.properties, httpRequestContext.userIdentity);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the identity profile.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGet(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileGetRequest
): Promise<IIdentityProfileGetResponse> {
	Guards.object<IIdentityProfileGetRequest>(ROUTES_SOURCE, nameof(request), request);

	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	const result = await service.get(
		request?.query?.propertyNames?.split(","),
		httpRequestContext.userIdentity
	);

	return {
		body: {
			identity: result.identity,
			properties: result.properties
		}
	};
}

/**
 * Get the identity public profile.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGetPublic(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileGetPublicRequest
): Promise<IIdentityProfileGetPublicResponse> {
	Guards.object<IIdentityProfileGetPublicRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);

	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	const result = await service.getPublic(
		request?.query?.propertyNames?.split(","),
		request?.pathParams.identity
	);

	return {
		body: {
			properties: result.properties
		}
	};
}

/**
 * Update an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileUpdate(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileUpdateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileUpdateRequest>(ROUTES_SOURCE, nameof(request), request);

	Guards.object<IIdentityProfileUpdateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);
	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	await service.update(request.body.properties, httpRequestContext.userIdentity);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileRemove(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: INoContentRequest
): Promise<INoContentResponse> {
	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	await service.remove(httpRequestContext.userIdentity);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the list of organizations.
 * @param httpRequestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identitiesList(
	httpRequestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileListRequest
): Promise<IIdentityProfileListResponse> {
	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	const filterPairs = request?.query?.filters?.split(",") ?? [];
	const filters = filterPairs.map(pair => {
		const parts = pair.split(":");
		return {
			propertyName: parts[0],
			propertyValue: parts[1]
		};
	});

	return {
		body: await service.list(
			filters,
			request?.query?.propertyNames?.split(","),
			request?.query?.cursor,
			Coerce.number(request.query?.pageSize)
		)
	};
}

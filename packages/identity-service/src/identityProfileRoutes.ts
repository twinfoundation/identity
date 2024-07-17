// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IConflictResponse,
	IHttpRequestContext,
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
	IIdentityProfileRemoveRequest
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
			handler: async (requestContext, request) =>
				identityProfileCreate(requestContext, serviceName, request),
			requestType: {
				type: nameof<IIdentityProfileCreateRequest>(),
				examples: [
					{
						id: "identityProfileCreateRequestExample",
						request: {
							body: {
								identity:
									"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
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
		path: `${baseRouteName}/:identity`,
		handler: async (requestContext, request) => identityGet(requestContext, serviceName, request),
		requestType: {
			type: nameof<IIdentityProfileGetRequest>(),
			examples: [
				{
					id: "identityGetProfileRequestExample",
					request: {
						pathParams: {
							identity:
								"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
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
				type: nameof<IIdentityProfileGetResponse>(),
				examples: [
					{
						id: "identityGetResponseExample",
						response: {
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
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityProfileUpdateRoute: IRestRoute<IIdentityProfileUpdateRequest, INoContentResponse> =
		{
			operationId: "identityProfileUpdate",
			summary: "Update an identity profile properties",
			tag: tagsIdentityProfile[0].name,
			method: "PUT",
			path: `${baseRouteName}/:identity`,
			handler: async (requestContext, request) =>
				identityProfileUpdate(requestContext, serviceName, request),
			requestType: {
				type: nameof<IIdentityProfileUpdateRequest>(),
				examples: [
					{
						id: "identityProfileUpdateRequestExample",
						request: {
							pathParams: {
								identity:
									"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
							},
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

	const identityProfileRemoveRoute: IRestRoute<IIdentityProfileRemoveRequest, INoContentResponse> =
		{
			operationId: "identityProfileRemove",
			summary: "Remove an identity profile",
			tag: tagsIdentityProfile[0].name,
			method: "DELETE",
			path: `${baseRouteName}/:identity`,
			handler: async (requestContext, request) =>
				identityProfileRemove(requestContext, serviceName, request),
			requestType: {
				type: nameof<IIdentityProfileRemoveRequest>(),
				examples: [
					{
						id: "identityProfileUpdateRequestExample",
						request: {
							pathParams: {
								identity:
									"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
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

	const identityProfileListRoute: IRestRoute<
		IIdentityProfileListRequest,
		IIdentityProfileListResponse
	> = {
		operationId: "identitiesProfileList",
		summary: "Get the list of profile data for identities",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/`,
		handler: async (requestContext, request) =>
			identitiesList(requestContext, serviceName, request),
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
								identities: [
									{
										identity:
											"did:gtsc:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
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
		identityProfileUpdateRoute,
		identityProfileRemoveRoute,
		identityProfileListRoute
	];
}

/**
 * Create an identity profile.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileCreate(
	requestContext: IHttpRequestContext,
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

	await service.create(request.body.identity, request.body.properties, requestContext);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the identity profile.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGet(
	requestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileGetRequest
): Promise<IIdentityProfileGetResponse> {
	Guards.object<IIdentityProfileGetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileGetRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);

	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	const result = await service.get(
		request.pathParams.identity,
		request?.query?.propertyNames?.split(","),
		requestContext
	);

	return {
		body: {
			properties: result.properties
		}
	};
}

/**
 * Update an identity profile.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileUpdate(
	requestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileUpdateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileUpdateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileUpdateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);
	Guards.object<IIdentityProfileUpdateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);
	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	await service.update(request.pathParams?.identity, request.body.properties, requestContext);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove an identity profile.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileRemove(
	requestContext: IHttpRequestContext,
	serviceName: string,
	request: IIdentityProfileRemoveRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileRemoveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileRemoveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);

	const service = ServiceFactory.get<IIdentityProfile>(serviceName);

	await service.remove(request.pathParams.identity, requestContext);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the list of organizations.
 * @param requestContext The request context for the API.
 * @param serviceName The name of the service to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identitiesList(
	requestContext: IHttpRequestContext,
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
			Coerce.number(request.query?.pageSize),
			requestContext
		)
	};
}

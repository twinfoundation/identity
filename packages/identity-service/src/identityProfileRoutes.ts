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
import { Coerce, ComponentFactory, Guards } from "@gtsc/core";
import type { IJsonLdDocument } from "@gtsc/data-json-ld";
import type {
	IIdentityProfileComponent,
	IIdentityProfileCreateRequest,
	IIdentityProfileGetPublicRequest,
	IIdentityProfileGetPublicResponse,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { HeaderTypes, HttpStatusCode, MimeTypes } from "@gtsc/web";

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
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesIdentityProfile(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const identityProfileCreateRoute: IRestRoute<IIdentityProfileCreateRequest, INoContentResponse> =
		{
			operationId: "identityProfileCreate",
			summary: "Create an identity profile",
			tag: tagsIdentityProfile[0].name,
			method: "POST",
			path: `${baseRouteName}/`,
			handler: async (httpRequestContext, request) =>
				identityProfileCreate(httpRequestContext, componentName, request),
			requestType: {
				type: nameof<IIdentityProfileCreateRequest>(),
				examples: [
					{
						id: "identityProfileCreateRequestExample",
						request: {
							body: {
								publicProfile: {
									"@context": "http://schema.org/",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								},
								privateProfile: {
									"@context": "http://schema.org/",
									"@type": "Person",
									telephone: "(425) 123-4567",
									url: "http://www.janedoe.com"
								}
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
			identityGet(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileGetRequest>(),
			examples: [
				{
					id: "identityGetProfileRequestExample",
					request: {
						query: {
							publicPropertyNames: "name,jobTitle"
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
								publicProfile: {
									"@context": "http://schema.org/",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								}
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
			identityGetPublic(httpRequestContext, componentName, request),
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
				mimeType: MimeTypes.JsonLd,
				examples: [
					{
						id: "identityGetPublicResponseExample",
						response: {
							headers: {
								[HeaderTypes.ContentType]: MimeTypes.JsonLd
							},
							body: {
								"@context": "http://schema.org/",
								"@type": "Person",
								jobTitle: "Professor",
								name: "Jane Doe"
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
				identityProfileUpdate(httpRequestContext, componentName, request),
			requestType: {
				type: nameof<IIdentityProfileUpdateRequest>(),
				examples: [
					{
						id: "identityProfileUpdateRequestExample",
						request: {
							body: {
								publicProfile: {
									"@context": "http://schema.org/",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								},
								privateProfile: {
									"@context": "http://schema.org/",
									"@type": "Person",
									telephone: "(425) 123-4567",
									url: "http://www.janedoe.com"
								}
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
			identityProfileRemove(httpRequestContext, componentName, request),
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
			identitiesList(httpRequestContext, componentName, request),
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
							publicFilters: "jobTitle:Professor"
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
										publicProfile: {
											"@context": "http://schema.org/",
											"@type": "Person",
											jobTitle: "Professor",
											name: "Jane Doe"
										}
									}
								],
								cursor: "1"
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
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileCreateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.create(
		request.body.publicProfile,
		request.body.privateProfile,
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGet(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileGetRequest
): Promise<IIdentityProfileGetResponse> {
	Guards.object<IIdentityProfileGetRequest>(ROUTES_SOURCE, nameof(request), request);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const result = await component.get(
		request?.query?.publicPropertyNames?.split(",") as (keyof IJsonLdDocument)[],
		request?.query?.privatePropertyNames?.split(",") as (keyof IJsonLdDocument)[],
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Get the identity public profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGetPublic(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileGetPublicRequest
): Promise<IIdentityProfileGetPublicResponse> {
	Guards.object<IIdentityProfileGetPublicRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const result = await component.getPublic(
		request?.pathParams.identity,
		request?.query?.propertyNames?.split(",") as (keyof IJsonLdDocument)[]
	);

	return {
		headers: {
			[HeaderTypes.ContentType]: MimeTypes.JsonLd
		},
		body: result
	};
}

/**
 * Update an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileUpdate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileUpdateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileUpdateRequest>(ROUTES_SOURCE, nameof(request), request);

	Guards.object<IIdentityProfileUpdateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);
	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.update(
		request.body.publicProfile,
		request.body.privateProfile,
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: INoContentRequest
): Promise<INoContentResponse> {
	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.remove(httpRequestContext.userIdentity);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the list of organizations.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identitiesList(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileListRequest
): Promise<IIdentityProfileListResponse> {
	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const publicFilterPairs = request?.query?.publicFilters?.split(",") ?? [];
	const publicFilters = publicFilterPairs.map(pair => {
		const parts = pair.split(":");
		return {
			propertyName: parts[0],
			propertyValue: parts[1]
		};
	});

	return {
		body: await component.list(
			publicFilters,
			request?.query?.publicPropertyNames?.split(",") as (keyof IJsonLdDocument)[],
			request?.query?.cursor,
			Coerce.number(request.query?.pageSize)
		)
	};
}

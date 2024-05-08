// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import type {
	ICreatedResponse,
	INotFoundResponse,
	IRestRoute,
	ISuccessResponse,
	ITag
} from "@gtsc/api-models";
import { Coerce, Guards } from "@gtsc/core";
import type {
	IIdentity,
	IIdentityCreateRequest,
	IIdentityGetRequest,
	IIdentityGetResponse,
	IIdentityListRequest,
	IIdentityListResponse,
	IIdentityUpdateRequest
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { ServiceFactory, type IRequestContext } from "@gtsc/services";
import { HttpStatusCodes } from "@gtsc/web";

/**
 * The context used when communicating about these routes.
 */
const ROUTES_CONTEXT = "identity";

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
	return [
		{
			operationId: "identityCreate",
			summary: "Create a new identity",
			tag: tags[0].name,
			method: "POST",
			path: `${routeName}/`,
			handler: async (requestContext, request, body) =>
				identityCreate(requestContext, serviceName, request, body),
			requestType: nameof<IIdentityCreateRequest>(),
			responseType: [
				{
					type: nameof<ICreatedResponse>(),
					statusCode: HttpStatusCodes.CREATED
				}
			]
		},
		{
			operationId: "identityUpdate",
			summary: "Update an identity",
			tag: tags[0].name,
			method: "PUT",
			path: `${routeName}/:identity`,
			handler: async (requestContext, request, body) =>
				identityUpdate(requestContext, serviceName, request, body),
			requestType: nameof<IIdentityUpdateRequest>(),
			responseType: [
				{
					type: nameof<ISuccessResponse>(),
					statusCode: HttpStatusCodes.OK
				},
				{
					type: nameof<INotFoundResponse>(),
					statusCode: HttpStatusCodes.NOT_FOUND
				}
			]
		},
		{
			operationId: "identityGet",
			summary: "Get the identity details",
			tag: tags[0].name,
			method: "GET",
			path: `${routeName}/:identity`,
			handler: async (requestContext, request, body) =>
				identityGet(requestContext, serviceName, request, body),
			requestType: nameof<IIdentityGetRequest>(),
			responseType: [
				{
					type: nameof<IIdentityGetResponse>(),
					statusCode: HttpStatusCodes.OK
				},
				{
					type: nameof<INotFoundResponse>(),
					statusCode: HttpStatusCodes.NOT_FOUND
				}
			]
		},
		{
			operationId: "identitiesList",
			summary: "Get the list of identities based on the provided criteria",
			tag: tags[0].name,
			method: "GET",
			path: `${routeName}/`,
			handler: async (requestContext, request, body) =>
				identitiesList(requestContext, serviceName, request, body),
			requestType: nameof<IIdentityListRequest>(),
			responseType: [
				{
					type: nameof<IIdentityListResponse>(),
					statusCode: HttpStatusCodes.OK
				}
			]
		}
	];
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
	Guards.object(ROUTES_CONTEXT, nameof(request.data), request.data);

	const identity = ServiceFactory.get<IIdentity>(serviceName);

	const result = await identity.identityCreate(
		requestContext,
		request.data.role,
		request.data.properties
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
	Guards.object(ROUTES_CONTEXT, nameof(request.data), request.data);
	const identity = ServiceFactory.get<IIdentity>(serviceName);

	return identity.identityUpdate(requestContext, request.identity, request.data.properties);
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
	const identity = ServiceFactory.get<IIdentity>(serviceName);

	const result = await identity.identityGet(requestContext, request.identity);

	return {
		data: {
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
	const identity = ServiceFactory.get<IIdentity>(serviceName);

	return {
		data: await identity.identityList(
			requestContext,
			request?.query?.role,
			request?.query?.propertyNames?.split(","),
			request?.query?.cursor,
			Coerce.number(request.query?.pageSize)
		)
	};
}

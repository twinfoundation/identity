// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IHttpRequestContext,
	INoContentResponse,
	IRestRoute,
	ITag
} from "@twin.org/api-models";
import { Coerce, ComponentFactory, Guards } from "@twin.org/core";
import {
	DocumentHelper,
	type IIdentityComponent,
	type IIdentityCreateRequest,
	type IIdentityCreateResponse,
	type IIdentityProofCreateRequest,
	type IIdentityProofCreateResponse,
	type IIdentityProofVerifyRequest,
	type IIdentityProofVerifyResponse,
	type IIdentityServiceCreateRequest,
	type IIdentityServiceCreateResponse,
	type IIdentityServiceRemoveRequest,
	type IIdentityVerifiableCredentialCreateRequest,
	type IIdentityVerifiableCredentialCreateResponse,
	type IIdentityVerifiableCredentialRevokeRequest,
	type IIdentityVerifiableCredentialUnrevokeRequest,
	type IIdentityVerifiableCredentialVerifyRequest,
	type IIdentityVerifiableCredentialVerifyResponse,
	type IIdentityVerifiablePresentationCreateRequest,
	type IIdentityVerifiablePresentationCreateResponse,
	type IIdentityVerifiablePresentationVerifyRequest,
	type IIdentityVerifiablePresentationVerifyResponse,
	type IIdentityVerificationMethodCreateRequest,
	type IIdentityVerificationMethodCreateResponse,
	type IIdentityVerificationMethodRemoveRequest
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import { DidContexts } from "@twin.org/standards-w3c-did";
import { HttpStatusCode } from "@twin.org/web";

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
	const identityCreateRoute: IRestRoute<IIdentityCreateRequest, IIdentityCreateResponse> = {
		operationId: "identityCreate",
		summary: "Create an identity",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			identityCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityCreateRequest>(),
			examples: [
				{
					id: "identityCreateRequestExample",
					request: {}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityCreateResponse>(),
				examples: [
					{
						id: "identityCreateResponseExample",
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
		]
	};

	const identityVerificationMethodCreateRoute: IRestRoute<
		IIdentityVerificationMethodCreateRequest,
		IIdentityVerificationMethodCreateResponse
	> = {
		operationId: "identityVerificationMethodCreate",
		summary: "Create an identity verification method",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/:identity/verification-method`,
		handler: async (httpRequestContext, request) =>
			identityVerificationMethodCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerificationMethodCreateRequest>(),
			examples: [
				{
					id: "identityVerificationMethodCreateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a"
						},
						body: {
							verificationMethodType: "assertionMethod",
							verificationMethodId: "my-assertion"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityVerificationMethodCreateResponse>(),
				examples: [
					{
						id: "identityVerificationMethodCreateResponseExample",
						response: {
							body: {
								id: "did:iota:tst:0x70ce5abe69e7c56dd69684dd6da65812b9758b03a0081331ca560b34d73d5ff0#my-assertion",
								controller:
									"did:iota:tst:0x70ce5abe69e7c56dd69684dd6da65812b9758b03a0081331ca560b34d73d5ff0",
								type: "JsonWebKey2020",
								publicKeyJwk: {
									kty: "OKP",
									alg: "EdDSA",
									kid: "f_fj3rGsZFSYvnS_xv5MgyIBlExq-lgDciu0YQ--S3s",
									crv: "Ed25519",
									x: "SFm32z7y9C17olpaTeocG25WV2CNTUl5MhM679Z4bok"
								}
							}
						}
					}
				]
			}
		]
	};

	const identityVerificationMethodRemoveRoute: IRestRoute<
		IIdentityVerificationMethodRemoveRequest,
		INoContentResponse
	> = {
		operationId: "identityVerificationMethodRemove",
		summary: "Remove an identity verification method",
		tag: tagsIdentity[0].name,
		method: "DELETE",
		path: `${baseRouteName}/:identity/verification-method/:verificationMethodId`,
		handler: async (httpRequestContext, request) =>
			identityVerificationMethodRemove(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerificationMethodRemoveRequest>(),
			examples: [
				{
					id: "identityVerificationMethodRemoveRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a",
							verificationMethodId: "my-assertion"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>(),
				examples: [
					{
						id: "identityVerificationMethodCreateResponseExample",
						response: {
							statusCode: HttpStatusCode.noContent
						}
					}
				]
			}
		]
	};

	const identityServiceCreateRoute: IRestRoute<
		IIdentityServiceCreateRequest,
		IIdentityServiceCreateResponse
	> = {
		operationId: "identityServiceCreate",
		summary: "Create an identity service",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/:identity/service`,
		handler: async (httpRequestContext, request) =>
			identityServiceCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityServiceCreateRequest>(),
			examples: [
				{
					id: "identityServiceCreateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a"
						},
						body: {
							serviceId: "did:example:123#linked-domain",
							type: "LinkedDomains",
							endpoint: "https://bar.example.com"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityServiceCreateResponse>(),
				examples: [
					{
						id: "identityServiceCreateResponseExample",
						response: {
							body: {
								id: "did:example:123#linked-domain",
								type: "LinkedDomains",
								serviceEndpoint: "https://bar.example.com"
							}
						}
					}
				]
			}
		]
	};

	const identityServiceRemoveRoute: IRestRoute<IIdentityServiceRemoveRequest, INoContentResponse> =
		{
			operationId: "identityServiceRemove",
			summary: "Remove an identity service",
			tag: tagsIdentity[0].name,
			method: "DELETE",
			path: `${baseRouteName}/:identity/service/:serviceId`,
			handler: async (httpRequestContext, request) =>
				identityServiceRemove(httpRequestContext, componentName, request),
			requestType: {
				type: nameof<IIdentityServiceRemoveRequest>(),
				examples: [
					{
						id: "identityServiceRemoveRequestExample",
						request: {
							pathParams: {
								identity:
									"did:iota:tst:0xe3088ba9aa8c28e1d139708a14e8c0fdff11ee8223baac4aa5bcf3321e4bfc6a",
								serviceId: "did:example:123#linked-domain"
							}
						}
					}
				]
			},
			responseType: [
				{
					type: nameof<INoContentResponse>(),
					examples: [
						{
							id: "identityServiceCreateResponseExample",
							response: {
								statusCode: HttpStatusCode.noContent
							}
						}
					]
				}
			]
		};

	const identityVerifiableCredentialCreateRoute: IRestRoute<
		IIdentityVerifiableCredentialCreateRequest,
		IIdentityVerifiableCredentialCreateResponse
	> = {
		operationId: "identityVerifiableCredentialCreate",
		summary: "Create an identity verifiable credential",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/:identity/verifiable-credential`,
		handler: async (httpRequestContext, request) =>
			identityVerifiableCredentialCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiableCredentialCreateRequest>(),
			examples: [
				{
					id: "identityVerifiableCredentialCreateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
							verificationMethodId: "my-assertion"
						},
						body: {
							credentialId: "https://example.com/credentials/3732",
							subject: {
								"@context": "https://schema.org",
								"@type": "Person",
								id: "did:entity-storage:0x4757993355b921a8229bd780f30921b6a0216a72e6c3f37a09d13b8426a17def",
								name: "Jane Doe"
							},
							revocationIndex: 5
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityVerifiableCredentialCreateResponse>(),
				examples: [
					{
						id: "identityVerifiableCredentialCreateResponseExample",
						response: {
							body: {
								verifiableCredential: {
									"@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org"],
									id: "https://example.com/credentials/3732",
									type: ["VerifiableCredential", "Person"],
									credentialSubject: {
										id: "did:entity-storage:0x4757993355b921a8229bd780f30921b6a0216a72e6c3f37a09d13b8426a17def",
										name: "Jane Doe"
									},
									issuer:
										"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
									issuanceDate: "2025-01-24T09:21:51.500Z",
									credentialStatus: {
										id: "did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a#revocation",
										type: "BitstringStatusList",
										revocationBitmapIndex: "5"
									}
								},
								jwt: "eyJraWQiOi...D1Z3AQ"
							}
						}
					}
				]
			}
		]
	};

	const identityVerifiableCredentialVerifyRoute: IRestRoute<
		IIdentityVerifiableCredentialVerifyRequest,
		IIdentityVerifiableCredentialVerifyResponse
	> = {
		operationId: "identityVerifiableCredentialVerify",
		summary: "Verify an identity verifiable credential",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/verifiable-credential/verify`,
		handler: async (httpRequestContext, request) =>
			identityVerifiableCredentialVerify(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiableCredentialVerifyRequest>(),
			examples: [
				{
					id: "identityVerifiableCredentialVerifyRequestExample",
					request: {
						query: {
							jwt: "eyJraWQiOi...D1Z3AQ"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityVerifiableCredentialVerifyResponse>(),
				examples: [
					{
						id: "identityVerifiableCredentialVerifyResponseExample",
						response: {
							body: {
								revoked: false,
								verifiableCredential: {
									"@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org"],
									id: "https://example.com/credentials/3732",
									type: ["VerifiableCredential", "Person"],
									credentialSubject: {
										id: "did:entity-storage:0x4757993355b921a8229bd780f30921b6a0216a72e6c3f37a09d13b8426a17def",
										name: "Jane Doe"
									},
									issuer:
										"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
									issuanceDate: "2025-01-24T09:21:51.500Z",
									credentialStatus: {
										id: "did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a#revocation",
										type: "BitstringStatusList",
										revocationBitmapIndex: "5"
									}
								}
							}
						}
					}
				]
			}
		],
		skipAuth: true
	};

	const identityVerifiableCredentialRevokeRoute: IRestRoute<
		IIdentityVerifiableCredentialRevokeRequest,
		INoContentResponse
	> = {
		operationId: "identityVerifiableCredentialRevoke",
		summary: "Revoke an identity verifiable credential",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/:identity/verifiable-credential/revoke/:revocationIndex`,
		handler: async (httpRequestContext, request) =>
			identityVerifiableCredentialRevoke(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiableCredentialRevokeRequest>(),
			examples: [
				{
					id: "identityVerifiableCredentialRevokeRequestExample",
					request: {
						pathParams: {
							identity:
								"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
							revocationIndex: 5
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>(),
				examples: [
					{
						id: "identityServiceRevokeResponseExample",
						response: {
							statusCode: HttpStatusCode.noContent
						}
					}
				]
			}
		]
	};

	const identityVerifiableCredentialUnrevokeRoute: IRestRoute<
		IIdentityVerifiableCredentialUnrevokeRequest,
		INoContentResponse
	> = {
		operationId: "identityVerifiableCredentialUnrevoke",
		summary: "Unrevoke an identity verifiable credential",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/:identity/verifiable-credential/unrevoke/:revocationIndex`,
		handler: async (httpRequestContext, request) =>
			identityVerifiableCredentialUnrevoke(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiableCredentialUnrevokeRequest>(),
			examples: [
				{
					id: "identityVerifiableCredentialUnrevokeRequestExample",
					request: {
						pathParams: {
							identity:
								"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
							revocationIndex: 5
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>(),
				examples: [
					{
						id: "identityServiceUnrevokeResponseExample",
						response: {
							statusCode: HttpStatusCode.noContent
						}
					}
				]
			}
		]
	};

	const identityVerifiablePresentationCreateRoute: IRestRoute<
		IIdentityVerifiablePresentationCreateRequest,
		IIdentityVerifiablePresentationCreateResponse
	> = {
		operationId: "identityVerifiablePresentationCreate",
		summary: "Create an identity verifiable presentation",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/:identity/verifiable-presentation`,
		handler: async (httpRequestContext, request) =>
			identityVerifiablePresentationCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiablePresentationCreateRequest>(),
			examples: [
				{
					id: "identityVerifiablePresentationCreateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:entity-storage:0x879c31386f992cfa29b77fe31e37256d69f6a57653cee4eb60ad4c4613c5515a",
							verificationMethodId: "my-assertion"
						},
						body: {
							presentationId: "https://example.com/presentation/3732",
							verifiableCredentials: ["eyJraWQiOi...D1Z3AQ"]
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityVerifiablePresentationCreateResponse>(),
				examples: [
					{
						id: "IIdentityVerifiablePresentationCreateResponseExample",
						response: {
							body: {
								verifiablePresentation: {
									"@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org"],
									id: "presentationId",
									type: ["VerifiablePresentation", "Person"],
									verifiableCredential: ["eyJraWQiOi...D1Z3AQ"],
									holder:
										"did:entity-storage:0xcea318e06e89f3fb4048160770effd84d0cfa5801fee13dfa6f9413a00429cec"
								},
								jwt: "eyJraWQiOi...D1Z3AQ"
							}
						}
					}
				]
			}
		]
	};

	const identityVerifiablePresentationVerifyRoute: IRestRoute<
		IIdentityVerifiablePresentationVerifyRequest,
		IIdentityVerifiablePresentationVerifyResponse
	> = {
		operationId: "identityVerifiablePresentationVerify",
		summary: "Verify an identity verifiable presentation",
		tag: tagsIdentity[0].name,
		method: "GET",
		path: `${baseRouteName}/verifiable-presentation/verify`,
		handler: async (httpRequestContext, request) =>
			identityVerifiablePresentationVerify(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityVerifiablePresentationVerifyRequest>(),
			examples: [
				{
					id: "identityVerifiablePresentationVerifyRequestExample",
					request: {
						query: {
							jwt: "eyJraWQiOi...D1Z3AQ"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityVerifiablePresentationVerifyResponse>(),
				examples: [
					{
						id: "identityVerifiablePresentationVerifyResponseExample",
						response: {
							body: {
								revoked: false,
								verifiablePresentation: {
									"@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org"],
									id: "presentationId",
									type: ["VerifiablePresentation", "Person"],
									verifiableCredential: ["eyJraWQiOi...D1Z3AQ"],
									holder:
										"did:entity-storage:0xcea318e06e89f3fb4048160770effd84d0cfa5801fee13dfa6f9413a00429cec"
								}
							}
						}
					}
				]
			}
		],
		skipAuth: true
	};

	const identityProofCreateRoute: IRestRoute<
		IIdentityProofCreateRequest,
		IIdentityProofCreateResponse
	> = {
		operationId: "identityProofCreate",
		summary: "Create an identity proof",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/:identity/proof`,
		handler: async (httpRequestContext, request) =>
			identityProofCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProofCreateRequest>(),
			examples: [
				{
					id: "identityProofCreateRequestExample",
					request: {
						pathParams: {
							identity:
								"did:entity-storage:0xda2df3ebc91ee0d5229d6532ffd0f4426952a94f34988b0ca906694dfd366a6a",
							verificationMethodId: "my-verification-id"
						},
						body: {
							proofType: "DataIntegrityProof",
							document: {
								"@context": [
									"https://www.w3.org/ns/credentials/v2",
									"https://www.w3.org/ns/credentials/examples/v2"
								],
								id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
								type: ["VerifiableCredential", "AlumniCredential"],
								name: "Alumni Credential",
								description: "A minimum viable example of an Alumni Credential.",
								issuer: "https://vc.example/issuers/5678",
								validFrom: "2023-01-01T00:00:00Z",
								credentialSubject: {
									id: "did:example:abcdefgh",
									alumniOf: "The School of Examples"
								}
							}
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProofCreateResponse>(),
				examples: [
					{
						id: "identityProofCreateResponseExample",
						response: {
							body: {
								"@context": [
									"https://www.w3.org/ns/credentials/v2",
									"https://www.w3.org/ns/credentials/examples/v2"
								],
								type: "DataIntegrityProof",
								cryptosuite: "eddsa-jcs-2022",
								created: "2024-01-31T16:00:45.490Z",
								verificationMethod:
									"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#my-verification-id",
								proofPurpose: "assertionMethod",
								proofValue:
									"z2zGoejwpX6HH2T11BZaniEVZrqRKDpwbQSvPcL7eL9M7hV5P9zQQZxs85n6qyDzkkXCL8aFUWfwQD5bxVGqDK1fa"
							}
						}
					}
				]
			}
		]
	};

	const identityProofVerifyRoute: IRestRoute<
		IIdentityProofVerifyRequest,
		IIdentityProofVerifyResponse
	> = {
		operationId: "identityProofVerify",
		summary: "Verify an identity proof",
		tag: tagsIdentity[0].name,
		method: "POST",
		path: `${baseRouteName}/proof/verify`,
		handler: async (httpRequestContext, request) =>
			identityProofVerify(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProofVerifyRequest>(),
			examples: [
				{
					id: "identityProofVerifyRequestExample",
					request: {
						body: {
							document: {
								"@context": [
									"https://www.w3.org/ns/credentials/v2",
									"https://www.w3.org/ns/credentials/examples/v2"
								],
								id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
								type: ["VerifiableCredential", "AlumniCredential"],
								name: "Alumni Credential",
								description: "A minimum viable example of an Alumni Credential.",
								issuer: "https://vc.example/issuers/5678",
								validFrom: "2023-01-01T00:00:00Z",
								credentialSubject: {
									id: "did:example:abcdefgh",
									alumniOf: "The School of Examples"
								}
							},
							proof: {
								"@context": "https://www.w3.org/ns/credentials/v2",
								type: "DataIntegrityProof",
								cryptosuite: "eddsa-jcs-2022",
								created: "2025-01-24T11:32:13.106Z",
								verificationMethod:
									"did:entity-storage:0xda2df3ebc91ee0d5229d6532ffd0f4426952a94f34988b0ca906694dfd366a6a#my-verification-id",
								proofPurpose: "assertionMethod",
								proofValue:
									"2fVLgANruCBoRPBCJavi54mZtkQdyMz6T2N4XVyB96asawiriKrVWoktcSQ7dMGrBTiemBBDpcLE2HfiTBCGuBmq"
							}
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProofVerifyResponse>(),
				examples: [
					{
						id: "identityProofVerifyResponseExample",
						response: {
							body: {
								verified: true
							}
						}
					}
				]
			}
		],
		skipAuth: true
	};

	return [
		identityCreateRoute,
		identityVerificationMethodCreateRoute,
		identityVerificationMethodRemoveRoute,
		identityServiceCreateRoute,
		identityServiceRemoveRoute,
		identityVerifiableCredentialCreateRoute,
		identityVerifiableCredentialVerifyRoute,
		identityVerifiableCredentialRevokeRoute,
		identityVerifiableCredentialUnrevokeRoute,
		identityVerifiablePresentationCreateRoute,
		identityVerifiablePresentationVerifyRoute,
		identityProofCreateRoute,
		identityProofVerifyRoute
	];
}

/**
 * Create an identity.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityCreateRequest
): Promise<IIdentityCreateResponse> {
	Guards.object<IIdentityCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.identityCreate(
		request.body?.namespace,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Create an identity verification method.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerificationMethodCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerificationMethodCreateRequest
): Promise<IIdentityVerificationMethodCreateResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerificationMethodCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityVerificationMethodCreateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.verificationMethodCreate(
		request.pathParams.identity,
		request.body.verificationMethodType,
		request.body.verificationMethodId,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Remove an identity verification method.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerificationMethodRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerificationMethodRemoveRequest
): Promise<INoContentResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerificationMethodRemoveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityVerificationMethodRemoveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.verificationMethodId),
		request.pathParams.verificationMethodId
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	await component.verificationMethodRemove(
		DocumentHelper.joinId(request.pathParams.identity, request.pathParams.verificationMethodId),
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Create an identity service.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityServiceCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityServiceCreateRequest
): Promise<IIdentityServiceCreateResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityServiceCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityServiceCreateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.serviceCreate(
		request.pathParams.identity,
		request.body.serviceId,
		request.body.type,
		request.body.endpoint,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Remove an identity service.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityServiceRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityServiceRemoveRequest
): Promise<INoContentResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityServiceRemoveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityServiceRemoveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.serviceId),
		request.pathParams.serviceId
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	await component.serviceRemove(
		DocumentHelper.joinId(request.pathParams.identity, request.pathParams.serviceId),
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Create a verifiable credential.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiableCredentialCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiableCredentialCreateRequest
): Promise<IIdentityVerifiableCredentialCreateResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerifiableCredentialCreateRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiableCredentialCreateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.verificationMethodId),
		request.pathParams.verificationMethodId
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.verifiableCredentialCreate(
		DocumentHelper.joinId(request.pathParams.identity, request.pathParams.verificationMethodId),
		request.body.credentialId,
		request.body.subject,
		request.body.revocationIndex,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Verify a verifiable credential.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiableCredentialVerify(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiableCredentialVerifyRequest
): Promise<IIdentityVerifiableCredentialVerifyResponse> {
	Guards.object<IIdentityVerifiableCredentialVerifyRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiableCredentialVerifyRequest["query"]>(
		ROUTES_SOURCE,
		nameof(request.query),
		request.query
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.query.jwt), request.query.jwt);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.verifiableCredentialVerify(request.query.jwt);

	return {
		body: result
	};
}

/**
 * Revoke a verifiable credential.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiableCredentialRevoke(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiableCredentialRevokeRequest
): Promise<INoContentResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerifiableCredentialRevokeRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiableCredentialRevokeRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const revocationIndex = Coerce.number(request.pathParams.revocationIndex);
	Guards.integer(ROUTES_SOURCE, nameof(request.pathParams.revocationIndex), revocationIndex);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	await component.verifiableCredentialRevoke(
		request.pathParams.identity,
		revocationIndex,
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Unrevoke a verifiable credential.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiableCredentialUnrevoke(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiableCredentialUnrevokeRequest
): Promise<INoContentResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerifiableCredentialUnrevokeRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiableCredentialUnrevokeRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);

	const revocationIndex = Coerce.number(request.pathParams.revocationIndex);
	Guards.integer(ROUTES_SOURCE, nameof(request.pathParams.revocationIndex), revocationIndex);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	await component.verifiableCredentialUnrevoke(
		request.pathParams.identity,
		revocationIndex,
		httpRequestContext.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Create a verifiable presentation.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiablePresentationCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiablePresentationCreateRequest
): Promise<IIdentityVerifiablePresentationCreateResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityVerifiablePresentationCreateRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiablePresentationCreateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.verificationMethodId),
		request.pathParams.verificationMethodId
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.verifiablePresentationCreate(
		DocumentHelper.joinId(request.pathParams.identity, request.pathParams.verificationMethodId),
		request.body.presentationId,
		request.body.contexts,
		request.body.types,
		request.body.verifiableCredentials,
		request.body.expiresInMinutes,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Verify a verifiable presentation.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityVerifiablePresentationVerify(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityVerifiablePresentationVerifyRequest
): Promise<IIdentityVerifiablePresentationVerifyResponse> {
	Guards.object<IIdentityVerifiablePresentationVerifyRequest>(
		ROUTES_SOURCE,
		nameof(request),
		request
	);
	Guards.object<IIdentityVerifiablePresentationVerifyRequest["query"]>(
		ROUTES_SOURCE,
		nameof(request.query),
		request.query
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.query.jwt), request.query.jwt);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.verifiablePresentationVerify(request.query.jwt);

	return {
		body: result
	};
}

/**
 * Create an identity proof.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProofCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProofCreateRequest
): Promise<IIdentityProofCreateResponse> {
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(httpRequestContext.userIdentity),
		httpRequestContext.userIdentity
	);
	Guards.object<IIdentityProofCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProofCreateRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.identity),
		request.pathParams.identity
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams.verificationMethodId),
		request.pathParams.verificationMethodId
	);
	Guards.object<IIdentityProofCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.proofCreate(
		request.pathParams.identity,
		request.body.proofType,
		request.body.document,
		httpRequestContext.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Verify an identity proof.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProofVerify(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProofVerifyRequest
): Promise<IIdentityProofVerifyResponse> {
	Guards.object<IIdentityProofVerifyRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProofCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const component = ComponentFactory.get<IIdentityComponent>(componentName);

	const result = await component.proofVerify(request.body.document, request.body.proof);

	return {
		body: {
			verified: result
		}
	};
}

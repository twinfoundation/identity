// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@twin.org/api-models";
import { Guards, Is } from "@twin.org/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@twin.org/data-json-ld";
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
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation,
	type IProof,
	ProofTypes
} from "@twin.org/standards-w3c-did";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityClient extends BaseRestClient implements IIdentityComponent {
	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<IdentityClient>();

	/**
	 * Create a new instance of IdentityClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityClient>(), config, "identity");
	}

	/**
	 * Create a new identity.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity document.
	 */
	public async identityCreate(namespace?: string): Promise<IDidDocument> {
		const response = await this.fetch<IIdentityCreateRequest, IIdentityCreateResponse>(
			"/",
			"POST",
			{
				body: {
					namespace
				}
			}
		);

		return response.body;
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param identity The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async verificationMethodCreate(
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);
		Guards.arrayOneOf<DidVerificationMethodType>(
			this.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);
		const response = await this.fetch<
			IIdentityVerificationMethodCreateRequest,
			IIdentityVerificationMethodCreateResponse
		>("/:identity/verification-method", "POST", {
			pathParams: {
				identity
			},
			body: {
				verificationMethodType,
				verificationMethodId
			}
		});

		return response.body;
	}

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async verificationMethodRemove(verificationMethodId: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		const idParts = DocumentHelper.parseId(verificationMethodId);

		await this.fetch<IIdentityVerificationMethodRemoveRequest, INoContentResponse>(
			"/:identity/verification-method/:verificationMethodId",
			"DELETE",
			{
				pathParams: {
					identity: idParts.id,
					verificationMethodId: idParts.fragment ?? ""
				}
			}
		);
	}

	/**
	 * Add a service to the document.
	 * @param identity The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceCreate(
		identity: string,
		serviceId: string,
		serviceType: string | string[],
		serviceEndpoint: string | string[]
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		if (Is.array(serviceType)) {
			Guards.arrayValue<string>(this.CLASS_NAME, nameof(serviceType), serviceType);
		} else {
			Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		}
		if (Is.array(serviceEndpoint)) {
			Guards.arrayValue<string>(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		} else {
			Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		}

		const response = await this.fetch<
			IIdentityServiceCreateRequest,
			IIdentityServiceCreateResponse
		>("/:identity/service", "POST", {
			pathParams: {
				identity
			},
			body: {
				serviceId,
				type: serviceType,
				endpoint: serviceEndpoint
			}
		});

		return response.body;
	}

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(serviceId: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);

		const idParts = DocumentHelper.parseId(serviceId);

		await this.fetch<IIdentityServiceRemoveRequest, INoContentResponse>(
			"/:identity/service/:serviceId",
			"DELETE",
			{
				pathParams: {
					identity: idParts.id,
					serviceId: idParts.fragment ?? ""
				}
			}
		);
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param id The id of the credential.
	 * @param subject The credential subject to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiableCredentialCreate(
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(subject), subject);
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<
			IIdentityVerifiableCredentialCreateRequest,
			IIdentityVerifiableCredentialCreateResponse
		>("/:identity/verifiable-credential", "POST", {
			pathParams: {
				identity: idParts.id,
				verificationMethodId: idParts.fragment ?? ""
			},
			body: {
				credentialId: id,
				subject,
				revocationIndex
			}
		});

		return response.body;
	}

	/**
	 * Verify a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async verifiableCredentialVerify(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(credentialJwt), credentialJwt);

		const response = await this.fetch<
			IIdentityVerifiableCredentialVerifyRequest,
			IIdentityVerifiableCredentialVerifyResponse
		>("/verifiable-credential/verify", "POST", {
			query: {
				jwt: credentialJwt
			}
		});

		return response.body;
	}

	/**
	 * Revoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialRevoke(
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(issuerId), issuerId);
		Guards.integer(this.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		await this.fetch<IIdentityVerifiableCredentialRevokeRequest, INoContentResponse>(
			"/:identity/verifiable-credential/revoke/:revocationIndex",
			"GET",
			{
				pathParams: {
					identity: issuerId,
					revocationIndex: credentialIndex
				}
			}
		);
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @returns Nothing.
	 */
	public async verifiableCredentialUnrevoke(
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(issuerId), issuerId);
		Guards.integer(this.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		await this.fetch<IIdentityVerifiableCredentialUnrevokeRequest, INoContentResponse>(
			"/:identity/verifiable-credential/unrevoke/:revocationIndex",
			"GET",
			{
				pathParams: {
					identity: issuerId,
					revocationIndex: credentialIndex
				}
			}
		);
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param verificationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiablePresentationCreate(
		verificationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential)[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		if (Is.array(types)) {
			Guards.arrayValue(this.CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(this.CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(this.CLASS_NAME, nameof(verifiableCredentials), verifiableCredentials);
		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(this.CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<
			IIdentityVerifiablePresentationCreateRequest,
			IIdentityVerifiablePresentationCreateResponse
		>("/:identity/verifiable-presentation", "POST", {
			pathParams: {
				identity: idParts.id,
				verificationMethodId: idParts.fragment ?? ""
			},
			body: {
				presentationId,
				contexts,
				types,
				verifiableCredentials,
				expiresInMinutes
			}
		});

		return response.body;
	}

	/**
	 * Verify a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async verifiablePresentationVerify(presentationJwt: string): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(presentationJwt), presentationJwt);

		const response = await this.fetch<
			IIdentityVerifiablePresentationVerifyRequest,
			IIdentityVerifiablePresentationVerifyResponse
		>("/verifiable-presentation/verify", "POST", {
			query: {
				jwt: presentationJwt
			}
		});

		return response.body;
	}

	/**
	 * Create a proof for a document with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @returns The proof.
	 */
	public async proofCreate(
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject
	): Promise<IProof> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.arrayOneOf<ProofTypes>(
			this.CLASS_NAME,
			nameof(proofType),
			proofType,
			Object.values(ProofTypes)
		);
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(unsecureDocument), unsecureDocument);

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<IIdentityProofCreateRequest, IIdentityProofCreateResponse>(
			"/:identity/proof",
			"POST",
			{
				pathParams: {
					identity: idParts.id,
					verificationMethodId: idParts.fragment ?? ""
				},
				body: {
					document: unsecureDocument,
					proofType
				}
			}
		);

		return response.body;
	}

	/**
	 * Verify proof for a document with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(document: IJsonLdNodeObject, proof: IProof): Promise<boolean> {
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(document), document);
		Guards.object<IProof>(this.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.verificationMethod), proof.verificationMethod);

		const response = await this.fetch<IIdentityProofVerifyRequest, IIdentityProofVerifyResponse>(
			"/proof/verify",
			"POST",
			{
				body: {
					document,
					proof
				}
			}
		);

		return response.body.verified;
	}
}

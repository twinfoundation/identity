// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@gtsc/identity-provider-models";
import type { IProperty } from "@gtsc/schema";
import type { IRequestContext, IService } from "@gtsc/services";
import type { IdentityRole } from "./identityRole";
import type { IIdentityClaimRequirement } from "./IIdentityClaimRequirement";
import type { IIdentityVerifiableCredentialApplication } from "./IIdentityVerifiableCredentialApplication";
import type { VerifiableCredentialState } from "./verifiableCredentialState";

/**
 * Interface describing a service which provides identity operations.
 */
export interface IIdentityService extends IService {
	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param role The role for the identity.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	identityCreate(
		requestContext: IRequestContext,
		role: IdentityRole,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}>;

	/**
	 * Get an item by identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	itemGet(
		requestContext: IRequestContext,
		identity: string,
		propertyNames?: string[]
	): Promise<{
		role: IdentityRole;
		properties?: IProperty[];
	}>;

	/**
	 * Update an item.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	itemUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties: IProperty[]
	): Promise<void>;

	/**
	 * Get a list of the requested types.
	 * @param requestContext The context for the request.
	 * @param role The role type to lookup.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	list(
		requestContext: IRequestContext,
		role: IdentityRole,
		propertyNames?: string[],
		cursor?: string,
		pageSize?: number
	): Promise<{
		/**
		 * The identities.
		 */
		identities: { identity: string; properties?: IProperty[] }[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
		/**
		 * Number of entities to return.
		 */
		pageSize?: number;
		/**
		 * Total entities length.
		 */
		totalEntities: number;
	}>;

	/**
	 * Set the requirements for a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param identity The identity the to store the requirements for.
	 * @param verifiableCredentialType The type of verifiable credential requirements being stored.
	 * @param requiredClaims The claims needed to create the verifiable credential.
	 * @returns Nothing.
	 */
	verifiableCredentialRequirementsSet(
		requestContext: IRequestContext,
		identity: string,
		verifiableCredentialType: string,
		requiredClaims?: IIdentityClaimRequirement[]
	): Promise<void>;

	/**
	 * Get the requirements for a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param identity The identity to get the requirements for.
	 * @param verifiableCredentialType The type of verifiable credential to get the requirements.
	 * @returns The requirements for creating the verifiable credential.
	 */
	verifiableCredentialRequirementsGet(
		requestContext: IRequestContext,
		identity: string,
		verifiableCredentialType: string
	): Promise<{
		matchDomains?: string;
		requiredClaims?: IIdentityClaimRequirement[];
	}>;

	/**
	 * Create a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param issuer The entity they want to create the verifiable credential with.
	 * @param subject The identity that is the subject of the verifiable credential.
	 * @param verifiableCredentialType The type of verifiable credential to perform.
	 * @param claims The completed claims providing information to create the verifiable credential.
	 * @returns The id of the verification credential generated, may not be immediately valid.
	 */
	verifiableCredentialCreate(
		requestContext: IRequestContext,
		issuer: string,
		subject: string,
		verifiableCredentialType: string,
		claims?: IProperty[]
	): Promise<string>;

	/**
	 * Update a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredentialId The verifiable credential to update.
	 * @param state The state to update to.
	 * @param rejectedCode The code for any rejections.
	 * @returns The updated application.
	 */
	verifiableCredentialUpdate(
		requestContext: IRequestContext,
		verifiableCredentialId: string,
		state: VerifiableCredentialState,
		rejectedCode?: string
	): Promise<IIdentityVerifiableCredentialApplication>;

	/**
	 * Gets all the verifiable credential applications for an identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity to get the verifiable credential applications for.
	 * @param identityIsIssuer The identity is the issuer not the subject.
	 * @param state The state of the verifiable application credentials to get.
	 * @param cursor The cursor for paged requests.
	 * @returns The verifiable credential applications details.
	 */
	verifiableCredentialApplications(
		requestContext: IRequestContext,
		identity: string,
		identityIsIssuer?: boolean,
		state?: VerifiableCredentialState,
		cursor?: string
	): Promise<{
		cursor?: string;
		applications: IIdentityVerifiableCredentialApplication[];
	}>;

	/**
	 * Gets a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredentialId The id of the verifiable credential.
	 * @returns The verifiable credential if successful.
	 */
	verifiableCredential<T>(
		requestContext: IRequestContext,
		verifiableCredentialId: string
	): Promise<IDidVerifiableCredential<T>>;

	/**
	 * Checks a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredential The verifiable credential details to check.
	 * @returns The verifiable credential check details.
	 */
	verifiableCredentialCheck<T>(
		requestContext: IRequestContext,
		verifiableCredential: IDidVerifiableCredential<T>
	): Promise<IDidVerifiableCredential<T>>;

	/**
	 * Sign arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param identity The identity to create the signature for.
	 * @param bytes The data bytes to sign.
	 * @param verificationMethod The verification method to use.
	 * @returns The signature type and value.
	 */
	signData(
		requestContext: IRequestContext,
		identity: string,
		bytes: Uint8Array,
		verificationMethod: string
	): Promise<{
		signatureType: string;
		signatureValue: string;
	}>;

	/**
	 * Verify arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param identity The identity to verify the signature for.
	 * @param bytes The data bytes to sign.
	 * @param verificationMethod The verification method to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @returns True if the signature is valid.
	 */
	verifyData(
		requestContext: IRequestContext,
		identity: string,
		bytes: Uint8Array,
		verificationMethod: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean>;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	IDidCredentialVerification,
	IDidVerifiableCredential
} from "@gtsc/identity-provider-models";
import type { IProperty } from "@gtsc/schema";
import type { IRequestContext, IService } from "@gtsc/services";
import type { IIdentityClaimRequirement } from "./IIdentityClaimRequirement";
import type { IIdentityVerifiableCredentialApplication } from "./IIdentityVerifiableCredentialApplication";
import type { IProfile } from "./IProfile";
import type { VerifiableCredentialState } from "./verifiableCredentialState";

/**
 * Interface describing a service which provides identity operations.
 */
export interface IIdentity extends IService {
	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	identityCreate(
		requestContext: IRequestContext,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity string.
		 */
		identity: string;

		/**
		 * Recovery phrase mnemonic.
		 */
		recoveryPhrase: string;

		/**
		 * Private key.
		 */
		privateKey: string;

		/**
		 * Public key.
		 */
		publicKey: string;
	}>;

	/**
	 * Update an identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties The profile properties.
	 * @returns Nothing.
	 */
	identityUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties?: IProperty[]
	): Promise<void>;

	/**
	 * Set the profile for an identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param emailAddress The email address for the identity.
	 * @param properties Properties for the profile.
	 * @param image The identity image data.
	 * @returns Nothing.
	 */
	profileSet(
		requestContext: IRequestContext,
		identity: string,
		emailAddress: string,
		image?: Uint8Array,
		properties?: IProperty[]
	): Promise<void>;

	/**
	 * Get the profile for an identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param secondaryIndex Secondary index of the search parameter.
	 * @returns The profile properties for the identity.
	 */
	profileGet(
		requestContext: IRequestContext,
		identity: string,
		secondaryIndex?: string
	): Promise<IProfile>;

	/**
	 * Get a list of all the organizations.
	 * @param requestContext The context for the request.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of organizations and cursor for paging.
	 */
	organizations(
		requestContext: IRequestContext,
		cursor?: string,
		pageSize?: number
	): Promise<{
		cursor?: string;
		organizations: {
			identity: string;
			name: string;
		}[];
		pageSize?: number;
	}>;

	/**
	 * Get a list of all the users in an organisation.
	 * @param requestContext The context for the request.
	 * @param identity The identity the to store the requirements for.
	 * @param cursor The cursor for paged requests.
	 * @returns The list of organization users and cursor for paging.
	 */
	organizationUsers(
		requestContext: IRequestContext,
		identity: string,
		cursor?: string
	): Promise<{
		/**
		 * The cursor for paged requests.
		 */
		nextPageCursor?: string;

		/**
		 * Organization users.
		 */
		users: {
			/**
			 * The user email.
			 */
			email: string;

			/**
			 * The user name.
			 */
			name: string;
		}[];
	}>;

	/**
	 * Get an organization.
	 * @param requestContext The context for the request.
	 * @param organizationIdentity The identity of the organization.
	 * @returns The organization details.
	 */
	organization(
		requestContext: IRequestContext,
		organizationIdentity: string
	): Promise<{
		name: string;
	}>;

	/**
	 * Set the requirements for a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param identity The identity the to store the requirements for.
	 * @param verifiableCredentialType The type of verifiable credential requirements being stored.
	 * @param matchDomains Verifiable credential applicants must match the users email domain.
	 * @param requiredClaims The claims needed to create the verifiable credential.
	 * @returns Nothing.
	 */
	verifiableCredentialRequirementsSet(
		requestContext: IRequestContext,
		identity: string,
		verifiableCredentialType: string,
		matchDomains?: string,
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
	): Promise<IDidCredentialVerification>;

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

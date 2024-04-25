// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, Converter, GeneralError, Guards, NotFoundError } from "@gtsc/core";
import { Bip39, Ed25519 } from "@gtsc/crypto";
import { ComparisonOperator } from "@gtsc/entity";
import type { IEntityStorageProvider } from "@gtsc/entity-storage-provider-models";
import type { IDidVerifiableCredential, IIdentityProvider } from "@gtsc/identity-provider-models";
import {
	type IIdentityClaimRequirement,
	type IIdentityVerifiableCredentialApplication,
	IdentityRole,
	VerifiableCredentialState,
	type IIdentityService
} from "@gtsc/identity-service-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper, type IProperty } from "@gtsc/schema";
import type { IRequestContext } from "@gtsc/services";
import type { IVaultProvider } from "@gtsc/vault-provider-models";
import type { IIdentityProfile } from "./models/IIdentityProfile";

/**
 * Class which implements the identity service.
 */
export class IdentityService implements IIdentityService {
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * The vault provider.
	 * @internal
	 */
	private readonly _vaultProvider: IVaultProvider;

	/**
	 * The identity provider.
	 * @internal
	 */
	private readonly _identityProvider: IIdentityProvider;

	/**
	 * The storage provider for the profiles.
	 * @internal
	 */
	private readonly _profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;

	/**
	 * Create a new instance of Identity.
	 * @param dependencies The dependencies for the identity service.
	 * @param dependencies.vaultProvider The vault provider.
	 * @param dependencies.identityProvider The identity provider.
	 * @param dependencies.profileStorageProvider The storage provider for the profiles.
	 */
	constructor(dependencies: {
		vaultProvider: IVaultProvider;
		identityProvider: IIdentityProvider;
		profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
	}) {
		Guards.object(IdentityService._CLASS_NAME, nameof(dependencies), dependencies);
		Guards.object(
			IdentityService._CLASS_NAME,
			nameof(dependencies.vaultProvider),
			dependencies.vaultProvider
		);
		Guards.object(
			IdentityService._CLASS_NAME,
			nameof(dependencies.identityProvider),
			dependencies.identityProvider
		);
		Guards.object(
			IdentityService._CLASS_NAME,
			nameof(dependencies.profileStorageProvider),
			dependencies.profileStorageProvider
		);

		this._vaultProvider = dependencies.vaultProvider;
		this._identityProvider = dependencies.identityProvider;
		this._profileStorageProvider = dependencies.profileStorageProvider;
	}

	/**
	 * Create a new identity.
	 * @param requestContext The context for the request.
	 * @param role The role for the identity.
	 * @param properties The profile properties.
	 * @returns The created identity details.
	 */
	public async identityCreate(
		requestContext: IRequestContext,
		role: IdentityRole,
		properties?: IProperty[]
	): Promise<{
		/**
		 * The identity created.
		 */
		identity: string;
	}> {
		Guards.arrayOneOf(IdentityService._CLASS_NAME, nameof(role), role, Object.values(IdentityRole));

		try {
			const mnemonic = Bip39.randomMnemonic();
			const seed = Bip39.mnemonicToSeed(mnemonic);
			const signKeyPair = Ed25519.keyPairFromSeed(seed);

			const document = await this._identityProvider.createDocument(
				signKeyPair.privateKey,
				signKeyPair.publicKey
			);

			await this._profileStorageProvider.set(requestContext, {
				identity: document.id,
				role,
				properties
			});

			await this._vaultProvider.set<{
				mnemonic: string;
				privateKey: string;
				publicKey: string;
			}>(requestContext, document.id, {
				mnemonic,
				privateKey: Converter.bytesToHex(signKeyPair.privateKey),
				publicKey: Converter.bytesToHex(signKeyPair.publicKey)
			});

			return {
				identity: document.id
			};
		} catch (error) {
			if (BaseError.someErrorMessage(error, /identity\./)) {
				throw error;
			}
			throw new GeneralError(IdentityService._CLASS_NAME, "identityCreateFailed", undefined, error);
		}
	}

	/**
	 * Get an item by identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity of the item to get.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async itemGet(
		requestContext: IRequestContext,
		identity: string,
		propertyNames?: string[]
	): Promise<{
		role: IdentityRole;
		properties?: IProperty[];
	}> {
		Guards.string(IdentityService._CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileStorageProvider.get(requestContext, identity);
			if (!profile) {
				throw new NotFoundError(IdentityService._CLASS_NAME, "identityGetFailed", identity);
			}

			return {
				role: profile.role,
				properties: PropertyHelper.filterInclude(profile.properties, propertyNames)
			};
		} catch (error) {
			throw new NotFoundError(IdentityService._CLASS_NAME, "identityGetFailed", identity, error);
		}
	}

	/**
	 * Update an item.
	 * @param requestContext The context for the request.
	 * @param identity The identity to update.
	 * @param properties Properties for the profile, set a properties value to undefined to remove it.
	 * @returns Nothing.
	 */
	public async itemUpdate(
		requestContext: IRequestContext,
		identity: string,
		properties: IProperty[]
	): Promise<void> {
		Guards.string(IdentityService._CLASS_NAME, nameof(identity), identity);

		try {
			const profile = await this._profileStorageProvider.get(requestContext, identity);
			if (!profile) {
				throw new NotFoundError(IdentityService._CLASS_NAME, "itemUpdateFailed", identity);
			}

			PropertyHelper.merge(profile.properties, properties);

			await this._profileStorageProvider.set(requestContext, profile);
		} catch (error) {
			throw new GeneralError(IdentityService._CLASS_NAME, "itemUpdateFailed", { identity }, error);
		}
	}

	/**
	 * Get a list of the requested types.
	 * @param requestContext The context for the request.
	 * @param role The role type to lookup.
	 * @param propertyNames The properties to get for the identities, default to all if undefined.
	 * @param cursor The cursor for paged requests.
	 * @param pageSize The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
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
	}> {
		Guards.string(IdentityService._CLASS_NAME, nameof(role), role);

		const result = await this._profileStorageProvider.query(requestContext, {
			property: "role",
			value: role,
			operator: ComparisonOperator.Equals
		});

		return {
			identities: result.entities.map(entity => ({
				identity: entity.identity ?? "",
				properties: PropertyHelper.filterInclude(entity.properties, propertyNames)
			})),
			cursor: result.cursor,
			pageSize: result.pageSize,
			totalEntities: result.totalEntities
		};
	}

	/**
	 * Set the requirements for a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param identity The identity the to store the requirements for.
	 * @param verifiableCredentialType The type of verifiable credential requirements being stored.
	 * @param requiredClaims The claims needed to create the verifiable credential.
	 * @returns Nothing.
	 */
	public async verifiableCredentialRequirementsSet(
		requestContext: IRequestContext,
		identity: string,
		verifiableCredentialType: string,
		requiredClaims?: IIdentityClaimRequirement[]
	): Promise<void> {}

	/**
	 * Get the requirements for a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param identity The identity to get the requirements for.
	 * @param verifiableCredentialType The type of verifiable credential to get the requirements.
	 * @returns The requirements for creating the verifiable credential.
	 */
	public async verifiableCredentialRequirementsGet(
		requestContext: IRequestContext,
		identity: string,
		verifiableCredentialType: string
	): Promise<{
		requiredClaims?: IIdentityClaimRequirement[];
	}> {
		return {
			requiredClaims: []
		};
	}

	/**
	 * Create a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param issuer The entity they want to create the verifiable credential with.
	 * @param subject The identity that is the subject of the verifiable credential.
	 * @param verifiableCredentialType The type of verifiable credential to perform.
	 * @param claims The completed claims providing information to create the verifiable credential.
	 * @returns The id of the verification credential generated, may not be immediately valid.
	 */
	public async verifiableCredentialCreate(
		requestContext: IRequestContext,
		issuer: string,
		subject: string,
		verifiableCredentialType: string,
		claims?: IProperty[]
	): Promise<string> {
		return "";
	}

	/**
	 * Update a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredentialId The verifiable credential to update.
	 * @param state The state to update to.
	 * @param rejectedCode The code for any rejections.
	 * @returns The updated application.
	 */
	public async verifiableCredentialUpdate(
		requestContext: IRequestContext,
		verifiableCredentialId: string,
		state: VerifiableCredentialState,
		rejectedCode?: string
	): Promise<IIdentityVerifiableCredentialApplication> {
		return {
			id: "",
			created: 0,
			updated: 0,
			issuer: "",
			subject: "",
			verifiableCredentialType: "",
			state: VerifiableCredentialState.PendingVerification
		};
	}

	/**
	 * Gets all the verifiable credential applications for an identity.
	 * @param requestContext The context for the request.
	 * @param identity The identity to get the verifiable credential applications for.
	 * @param identityIsIssuer The identity is the issuer not the subject.
	 * @param state The state of the verifiable application credentials to get.
	 * @param cursor The cursor for paged requests.
	 * @returns The verifiable credential applications details.
	 */
	public async verifiableCredentialApplications(
		requestContext: IRequestContext,
		identity: string,
		identityIsIssuer?: boolean,
		state?: VerifiableCredentialState,
		cursor?: string
	): Promise<{
		cursor?: string;
		applications: IIdentityVerifiableCredentialApplication[];
	}> {
		return {
			cursor: "",
			applications: []
		};
	}

	/**
	 * Gets a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredentialId The id of the verifiable credential.
	 * @returns The verifiable credential if successful.
	 */
	public async verifiableCredential<T>(
		requestContext: IRequestContext,
		verifiableCredentialId: string
	): Promise<IDidVerifiableCredential<T>> {
		return {
			"@context": "",
			issuer: "",
			id: "",
			type: [],
			issuanceDate: "",
			credentialSubject: {} as T
		};
	}

	/**
	 * Checks a verifiable credential.
	 * @param requestContext The context for the request.
	 * @param verifiableCredential The verifiable credential details to check.
	 * @returns The verifiable credential check details.
	 */
	public async verifiableCredentialCheck<T>(
		requestContext: IRequestContext,
		verifiableCredential: IDidVerifiableCredential<T>
	): Promise<IDidVerifiableCredential<T>> {
		return {
			"@context": "",
			issuer: "",
			id: "",
			type: [],
			issuanceDate: "",
			credentialSubject: {} as T
		};
	}

	/**
	 * Sign arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param identity The identity to create the signature for.
	 * @param bytes The data bytes to sign.
	 * @param verificationMethod The verification method to use.
	 * @returns The signature type and value.
	 */
	public async signData(
		requestContext: IRequestContext,
		identity: string,
		bytes: Uint8Array,
		verificationMethod: string
	): Promise<{
		signatureType: string;
		signatureValue: string;
	}> {
		return {
			signatureType: "",
			signatureValue: ""
		};
	}

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
	public async verifyData(
		requestContext: IRequestContext,
		identity: string,
		bytes: Uint8Array,
		verificationMethod: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean> {
		return true;
	}
}

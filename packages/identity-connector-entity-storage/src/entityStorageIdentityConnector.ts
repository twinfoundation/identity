// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BitString,
	Coerce,
	Compression,
	Converter,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import type { IEntityStorageConnector } from "@gtsc/entity-storage-models";
import type { IIdentityConnector } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IRequestContext } from "@gtsc/services";
import type {
	DidVerificationMethodType,
	IDidDocument,
	IDidDocumentVerificationMethod,
	IDidService,
	IDidVerifiableCredential,
	IDidVerifiablePresentation
} from "@gtsc/standards-w3c-did";
import type { IVaultConnector } from "@gtsc/vault-models";
import { Jwt, type IJwk, type IJwtHeader, type IJwtPayload } from "@gtsc/web";
import type { IEntityStorageIdentityConnectorConfig } from "./models/IEntityStorageIdentityConnectorConfig";
import type { IIdentityDocument } from "./models/IIdentityDocument";

/**
 * Class for performing identity operations using entity storage.
 */
export class EntityStorageIdentityConnector implements IIdentityConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static NAMESPACE: string = "entity-storage";

	/**
	 * The size of the revocation bitmap in bits (16Kb).
	 */
	public static REVOCATION_BITS_SIZE: number = 131072;

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<EntityStorageIdentityConnector>();

	/**
	 * The entity storage for identities.
	 * @internal
	 */
	private readonly _didDocumentEntityStorage: IEntityStorageConnector<IIdentityDocument>;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The configuration for the connector.
	 * @internal
	 */
	private readonly _config: IEntityStorageIdentityConnectorConfig;

	/**
	 * Create a new instance of EntityStorageIdentityConnector.
	 * @param dependencies The dependencies for the identity connector.
	 * @param dependencies.didDocumentEntityStorage The entity storage for the did documents.
	 * @param dependencies.vaultConnector The vault for the private keys.
	 * @param config The configuration for the connector.
	 */
	constructor(
		dependencies: {
			didDocumentEntityStorage: IEntityStorageConnector<IIdentityDocument>;
			vaultConnector: IVaultConnector;
		},
		config?: IEntityStorageIdentityConnectorConfig
	) {
		Guards.object<EntityStorageIdentityConnector>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(dependencies),
			dependencies
		);
		Guards.object<EntityStorageIdentityConnector>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(dependencies.didDocumentEntityStorage),
			dependencies.didDocumentEntityStorage
		);
		Guards.object<EntityStorageIdentityConnector>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(dependencies.vaultConnector),
			dependencies.vaultConnector
		);
		this._didDocumentEntityStorage = dependencies.didDocumentEntityStorage;
		this._vaultConnector = dependencies.vaultConnector;

		config ??= {};
		config.didMethod ??= "gtsc";
		this._config = config;
	}

	/**
	 * Create a new document.
	 * @param requestContext The context for the request.
	 * @param privateKey The private key to use for the document in base64, if undefined a new key will be generated.
	 * @param publicKey The public key to use for the document in base64, must be provided if privateKey is supplied.
	 * @returns The created document.
	 */
	public async createDocument(
		requestContext: IRequestContext,
		privateKey?: string,
		publicKey?: string
	): Promise<IDidDocument> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		const hasPrivateKey = Is.stringValue(privateKey);
		if (hasPrivateKey) {
			Guards.stringBase64(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(privateKey),
				privateKey
			);
		}
		const hasPublicKey = Is.stringValue(publicKey);
		if (hasPublicKey) {
			Guards.stringBase64(EntityStorageIdentityConnector._CLASS_NAME, nameof(publicKey), publicKey);
		}
		if (hasPrivateKey !== hasPublicKey) {
			throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "privateAndPublic");
		}

		try {
			const did = `did:${this._config.didMethod}:${Converter.bytesToHex(RandomHelper.generate(32), true)}`;

			if (hasPrivateKey && hasPublicKey) {
				await this._vaultConnector.addKey(requestContext, did, "Ed25519", privateKey, publicKey);
			} else {
				await this._vaultConnector.createKey(requestContext, did, "Ed25519");
			}

			const bitString = new BitString(EntityStorageIdentityConnector.REVOCATION_BITS_SIZE);
			const compressed = await Compression.compress(bitString.getBits(), "gzip");

			const didDocument: IDidDocument = {
				id: did,
				service: [
					{
						id: `${did}#revocation`,
						type: "BitstringStatusList",
						serviceEndpoint: `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`
					}
				]
			};

			await this.updateDocument(requestContext, didDocument);

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"createDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(
		requestContext: IRequestContext,
		documentId: string
	): Promise<IDidDocument> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);

			return JSON.parse(didIdentityDocument.document) as IDidDocument;
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"resolveDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.arrayOneOf(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			[
				"verificationMethod",
				"authentication",
				"assertionMethod",
				"keyAgreement",
				"capabilityInvocation",
				"capabilityDelegation"
			]
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);

			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const tempKeyId = `temp-${Converter.bytesToBase64Url(RandomHelper.generate(32))}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				requestContext,
				tempKeyId,
				"Ed25519"
			);

			const jwkParams: IJwk = {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: Converter.bytesToBase64Url(Converter.base64ToBytes(verificationPublicKey))
			};

			const kid = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const methodId = `${documentId}#${verificationMethodId ?? kid}`;

			await this._vaultConnector.renameKey(requestContext, tempKeyId, methodId);

			const methods = this.getAllMethods(didDocument);
			const existingMethodIndex = methods.findIndex(m => {
				if (Is.string(m.method)) {
					return m.method === methodId;
				}
				return m.method.id === methodId;
			});

			if (existingMethodIndex >= 0) {
				const methodArray =
					didDocument[methods[existingMethodIndex].arrayKey as keyof IDidDocument];

				if (Is.array(methodArray)) {
					methodArray.splice(existingMethodIndex, 1);
				}
			}

			const didVerificationMethod: IDidDocumentVerificationMethod = {
				id: methodId,
				controller: documentId,
				type: "JsonWebKey",
				publicKeyJwk: {
					...jwkParams,
					kid
				}
			};

			didDocument[verificationMethodType] ??= [];
			didDocument[verificationMethodType]?.push(didVerificationMethod);

			await this.updateDocument(requestContext, didDocument);

			return didVerificationMethod;
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(didDocument);
			const existingMethodIndex = methods.findIndex(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (existingMethodIndex >= 0) {
				const methodArray =
					didDocument[methods[existingMethodIndex].arrayKey as keyof IDidDocument];

				if (Is.array(methodArray)) {
					methodArray.splice(existingMethodIndex, 1);
					if (methodArray.length === 0) {
						delete didDocument[methods[existingMethodIndex].arrayKey as keyof IDidDocument];
					}
				}
			} else {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			await this.updateDocument(requestContext, didDocument);
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(serviceType),
			serviceType
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(serviceEndpoint),
			serviceEndpoint
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === serviceId);
				if (existingServiceIndex >= 0) {
					didDocument.service?.splice(existingServiceIndex, 1);
				}
			}

			const didService: IDidService = {
				id: serviceId,
				type: serviceType,
				serviceEndpoint
			};

			didDocument.service ??= [];
			didDocument.service.push(didService);

			await this.updateDocument(requestContext, didDocument);

			return didService;
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"addServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document to remove the service from.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		requestContext: IRequestContext,
		documentId: string,
		serviceId: string
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === serviceId);
				if (existingServiceIndex >= 0) {
					didDocument.service?.splice(existingServiceIndex, 1);
					if (didDocument.service?.length === 0) {
						delete didDocument.service;
					}
				}
			} else {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"serviceNotFound",
					serviceId
				);
			}

			await this.updateDocument(requestContext, didDocument);
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"removeServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		verificationMethodId: string,
		credentialId: string,
		schemaTypes: string | string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(credentialId),
			credentialId
		);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(schemaTypes),
				schemaTypes
			);
		} else {
			Guards.stringValue(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(schemaTypes),
				schemaTypes
			);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(EntityStorageIdentityConnector._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(EntityStorageIdentityConnector._CLASS_NAME, nameof(subject), subject);
		}
		Guards.number(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(revocationIndex),
			revocationIndex
		);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				issuerDocumentId
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}
			await this.verifyDocument(requestContext, issuerIdentityDocument);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const verificationDidMethod = methodAndArray.method;
			if (!Is.stringValue(verificationDidMethod.publicKeyJwk?.x)) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const revocationService = issuerDidDocument.service?.find(s => s.id.endsWith("#revocation"));

			const verifiableCredential: IDidVerifiableCredential<T> = {
				"@context": "https://www.w3.org/2018/credentials/v1",
				id: credentialId,
				type: ["VerifiableCredential", ...(Is.array(schemaTypes) ? schemaTypes : [schemaTypes])],
				credentialSubject: subject,
				issuer: issuerDidDocument.id,
				issuanceDate: new Date().toISOString(),
				credentialStatus: revocationService
					? {
							id: revocationService.id,
							type: Is.array(revocationService.type)
								? revocationService.type[0]
								: revocationService.type,
							revocationBitmapIndex: revocationIndex.toString()
						}
					: undefined
			};

			const jwtHeader: IJwtHeader = {
				kid: verificationDidMethod.id,
				typ: "JWT",
				alg: "EdDSA"
			};

			const jwtVc = ObjectHelper.pick(ObjectHelper.clone(verifiableCredential), [
				"@context",
				"type",
				"credentialSubject",
				"credentialStatus"
			]);

			if (Is.array(jwtVc.credentialSubject)) {
				jwtVc.credentialSubject = jwtVc.credentialSubject.map(c => {
					delete c.id;
					return c;
				});
			} else {
				delete jwtVc.credentialSubject?.id;
			}

			const jwtPayload: IJwtPayload = {
				iss: issuerDocumentId,
				nbf: Math.floor(Date.now() / 1000),
				jti: verifiableCredential.id,
				sub: Is.array(subject) ? subject[0].id : subject.id,
				vc: jwtVc
			};

			const signature = await Jwt.encode(
				jwtHeader,
				jwtPayload,
				undefined,
				async (alg, key, payload) => {
					const sig = await this._vaultConnector.sign(
						requestContext,
						verificationMethodId,
						Converter.bytesToBase64(payload)
					);
					return Converter.base64ToBytes(sig);
				}
			);

			return {
				verifiableCredential,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"createVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param requestContext The context for the request.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T extends { id?: string }>(
		requestContext: IRequestContext,
		credentialJwt: string
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(credentialJwt),
			credentialJwt
		);

		try {
			const jwtDecoded = await Jwt.decode(credentialJwt);

			const jwtHeader = jwtDecoded.header;
			const jwtPayload = jwtDecoded.payload;
			const jwtSignature = jwtDecoded.signature;

			if (
				Is.undefined(jwtHeader) ||
				Is.undefined(jwtPayload) ||
				Is.undefined(jwtPayload.iss) ||
				Is.undefined(jwtSignature)
			) {
				throw new NotFoundError(EntityStorageIdentityConnector._CLASS_NAME, "jwkSignatureFailed");
			}

			const issuerDocumentId = jwtPayload.iss;
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				issuerDocumentId
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}
			await this.verifyDocument(requestContext, issuerIdentityDocument);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;
			console.log(issuerDidDocument);
			console.log(jwtHeader.kid);

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === jwtHeader.kid;
				}
				return m.method.id === jwtHeader.kid;
			});

			if (!methodAndArray) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const verified = Jwt.verifySignature(
				jwtHeader,
				jwtPayload,
				jwtSignature,
				Converter.base64UrlToBytes(didMethod.publicKeyJwk.x)
			);

			if (!verified) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "jwkSignatureFailed");
			}

			const verifiableCredential = jwtPayload.vc as IDidVerifiableCredential<T>;
			if (Is.object(verifiableCredential)) {
				if (Is.string(jwtPayload.jti)) {
					verifiableCredential.id = jwtPayload.jti;
				}
				verifiableCredential.issuer = issuerDocumentId;
				if (Is.number(jwtPayload.nbf)) {
					verifiableCredential.issuanceDate = new Date(jwtPayload.nbf * 1000).toISOString();
				}
				if (Is.array(verifiableCredential.credentialSubject)) {
					verifiableCredential.credentialSubject = verifiableCredential.credentialSubject.map(c => {
						ObjectHelper.propertySet(c, "id", jwtPayload.sub);
						return c;
					});
				} else if (Is.object(verifiableCredential.credentialSubject)) {
					ObjectHelper.propertySet(verifiableCredential.credentialSubject, "id", jwtPayload.sub);
				}
			}

			const revoked = await this.checkRevocation(
				issuerDidDocument,
				verifiableCredential.credentialStatus?.revocationBitmapIndex
			);

			return {
				revoked,
				verifiableCredential: revoked ? undefined : verifiableCredential
			};
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.arrayValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				issuerDocumentId
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}
			await this.verifyDocument(requestContext, issuerIdentityDocument);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;

			const revocationService = issuerDidDocument.service?.find(s => s.id.endsWith("#revocation"));
			if (
				revocationService &&
				Is.string(revocationService.serviceEndpoint) &&
				revocationService.type === "BitstringStatusList"
			) {
				const revocationParts = revocationService.serviceEndpoint.split(",");
				if (revocationParts.length === 2) {
					const compressedRevocationBytes = Converter.base64UrlToBytes(revocationParts[1]);
					const decompressed = await Compression.decompress(compressedRevocationBytes, "gzip");

					const bitString = BitString.fromBits(
						decompressed,
						EntityStorageIdentityConnector.REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, true);
					}

					const compressed = await Compression.compress(bitString.getBits(), "gzip");
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			await this.updateDocument(requestContext, issuerDidDocument);
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param requestContext The context for the request.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		requestContext: IRequestContext,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.arrayValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				issuerDocumentId
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}
			await this.verifyDocument(requestContext, issuerIdentityDocument);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;

			const revocationService = issuerDidDocument.service?.find(s => s.id.endsWith("#revocation"));
			if (
				revocationService &&
				Is.string(revocationService.serviceEndpoint) &&
				revocationService.type === "BitstringStatusList"
			) {
				const revocationParts = revocationService.serviceEndpoint.split(",");
				if (revocationParts.length === 2) {
					const compressedRevocationBytes = Converter.base64UrlToBytes(revocationParts[1]);
					const decompressed = await Compression.decompress(compressedRevocationBytes, "gzip");

					const bitString = BitString.fromBits(
						decompressed,
						EntityStorageIdentityConnector.REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, false);
					}

					const compressed = await Compression.compress(bitString.getBits(), "gzip");
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			await this.updateDocument(requestContext, issuerDidDocument);
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param requestContext The context for the request.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		requestContext: IRequestContext,
		holderDocumentId: string,
		presentationMethodId: string,
		schemaTypes: string | string[],
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(holderDocumentId),
			holderDocumentId
		);

		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(presentationMethodId),
			presentationMethodId
		);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(schemaTypes),
				schemaTypes
			);
		} else {
			Guards.stringValue(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(schemaTypes),
				schemaTypes
			);
		}
		Guards.arrayValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);

		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(
				EntityStorageIdentityConnector._CLASS_NAME,
				nameof(expiresInMinutes),
				expiresInMinutes
			);
		}

		try {
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				holderDocumentId
			);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}
			await this.verifyDocument(requestContext, holderIdentityDocument);
			const holderDidDocument = JSON.parse(holderIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(holderDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === presentationMethodId;
				}
				return m.method.id === presentationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const verifiablePresentation: IDidVerifiablePresentation = {
				"@context": "https://www.w3.org/2018/credentials/v1",
				type: ["VerifiablePresentation"].concat(
					Is.array(schemaTypes) ? schemaTypes : [schemaTypes]
				),
				verifiableCredential: verifiableCredentials,
				holder: holderDocumentId
			};

			const jwtHeader: IJwtHeader = {
				kid: didMethod.id,
				typ: "JWT",
				alg: "EdDSA"
			};

			const jwtVp = ObjectHelper.pick(ObjectHelper.clone(verifiablePresentation), [
				"@context",
				"type",
				"verifiableCredential"
			]);

			const jwtPayload: IJwtPayload = {
				iss: holderDocumentId,
				nbf: Math.floor(Date.now() / 1000),
				vp: jwtVp
			};

			if (Is.integer(expiresInMinutes)) {
				const expiresInSeconds = expiresInMinutes * 60;
				jwtPayload.exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
			}

			const signature = await Jwt.encode(
				jwtHeader,
				jwtPayload,
				undefined,
				async (alg, key, payload) => {
					const sig = await this._vaultConnector.sign(
						requestContext,
						presentationMethodId,
						Converter.bytesToBase64(payload)
					);
					return Converter.base64ToBytes(sig);
				}
			);

			return {
				verifiablePresentation,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"createVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable presentation is valid.
	 * @param requestContext The context for the request.
	 * @param presentationJwt The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async checkVerifiablePresentation(
		requestContext: IRequestContext,
		presentationJwt: string
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(presentationJwt),
			presentationJwt
		);

		try {
			const jwtDecoded = await Jwt.decode(presentationJwt);

			const jwtHeader = jwtDecoded.header;
			const jwtPayload = jwtDecoded.payload;
			const jwtSignature = jwtDecoded.signature;

			if (
				Is.undefined(jwtHeader) ||
				Is.undefined(jwtPayload) ||
				Is.undefined(jwtPayload.iss) ||
				Is.undefined(jwtSignature)
			) {
				throw new NotFoundError(EntityStorageIdentityConnector._CLASS_NAME, "jwkSignatureFailed");
			}

			const holderDocumentId = jwtPayload.iss;
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				holderDocumentId
			);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}
			await this.verifyDocument(requestContext, holderIdentityDocument);

			const issuers: IDidDocument[] = [];
			const tokensRevoked: boolean[] = [];
			const verifiablePresentation = jwtPayload?.vp as IDidVerifiablePresentation;
			if (
				Is.object<IDidVerifiablePresentation>(verifiablePresentation) &&
				Is.array(verifiablePresentation.verifiableCredential)
			) {
				for (const vcJwt of verifiablePresentation.verifiableCredential) {
					const jwt = await Jwt.decode(vcJwt);
					let revoked = true;

					if (Is.string(jwt.payload?.iss)) {
						const issuerDocumentId = jwt.payload.iss;
						verifiablePresentation.holder = issuerDocumentId;

						const issuerDidDocument = await this._didDocumentEntityStorage.get(
							requestContext,
							issuerDocumentId
						);
						if (Is.undefined(issuerDidDocument)) {
							throw new NotFoundError(
								EntityStorageIdentityConnector._CLASS_NAME,
								"documentNotFound",
								issuerDocumentId
							);
						}
						await this.verifyDocument(requestContext, issuerDidDocument);
						issuers.push(issuerDidDocument);

						const vc = jwt.payload.vc as IDidVerifiableCredential;
						if (Is.object<IDidVerifiableCredential>(vc)) {
							revoked = await this.checkRevocation(
								issuerDidDocument,
								vc.credentialStatus?.revocationBitmapIndex
							);
						}
					}
					tokensRevoked.push(revoked);
				}
			}

			return {
				revoked: tokensRevoked.some(Boolean),
				verifiablePresentation,
				issuers
			};
		} catch (error) {
			if (error instanceof Error && error.message.toLowerCase().includes("revoked")) {
				return {
					revoked: true
				};
			}

			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign in base64.
	 * @returns The proof signature type and value in base64.
	 */
	public async createProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: string
	): Promise<{
		type: string;
		value: string;
	}> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		Guards.string(EntityStorageIdentityConnector._CLASS_NAME, nameof(bytes), bytes);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(didDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			const signature = await this._vaultConnector.sign(
				requestContext,
				verificationMethodId,
				bytes
			);

			return {
				type: "Ed25519",
				value: signature
			};
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"createProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param requestContext The context for the request.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify in base64.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof in base64.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		requestContext: IRequestContext,
		documentId: string,
		verificationMethodId: string,
		bytes: string,
		signatureType: string,
		signatureValue: string
	): Promise<boolean> {
		Guards.object<IRequestContext>(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext),
			requestContext
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.tenantId),
			requestContext.tenantId
		);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(requestContext.identity),
			requestContext.identity
		);
		Guards.stringValue(EntityStorageIdentityConnector._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.string(EntityStorageIdentityConnector._CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(signatureType),
			signatureType
		);
		Guards.string(
			EntityStorageIdentityConnector._CLASS_NAME,
			nameof(signatureValue),
			signatureValue
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				requestContext,
				documentId
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityConnector._CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await this.verifyDocument(requestContext, didIdentityDocument);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(didDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(EntityStorageIdentityConnector._CLASS_NAME, "publicKeyJwkMissing");
			}

			return this._vaultConnector.verify(
				requestContext,
				verificationMethodId,
				bytes,
				signatureValue
			);
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"verifyProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Get all the methods from a document.
	 * @param document The document to get the methods from.
	 * @returns The methods.
	 */
	private getAllMethods(
		document: IDidDocument
	): { arrayKey: string; method: Partial<IDidDocumentVerificationMethod> }[] {
		const methods: {
			arrayKey: string;
			method: Partial<IDidDocumentVerificationMethod>;
		}[] = [];

		const methodTypes: DidVerificationMethodType[] = [
			"verificationMethod",
			"authentication",
			"assertionMethod",
			"keyAgreement",
			"capabilityInvocation",
			"capabilityDelegation"
		];

		for (const methodType of methodTypes) {
			const mt = document[methodType];
			if (Is.arrayValue(mt)) {
				methods.push(
					...mt.map(m => ({
						arrayKey: methodType,
						method: Is.string(m) ? { id: m } : m
					}))
				);
			}
		}

		return methods;
	}

	/**
	 * Check if a revocation index is revoked.
	 * @param document The document to check.
	 * @param revocationBitmapIndex The revocation index to check.
	 * @returns True if the index is revoked.
	 */
	private async checkRevocation(
		document: IDidDocument,
		revocationBitmapIndex?: unknown
	): Promise<boolean> {
		if (Is.stringValue(revocationBitmapIndex)) {
			const revocationIndex = Coerce.number(revocationBitmapIndex);
			if (Is.number(revocationIndex)) {
				const revocationService = document.service?.find(s => s.id.endsWith("#revocation"));
				if (
					revocationService &&
					Is.string(revocationService.serviceEndpoint) &&
					revocationService.type === "BitstringStatusList"
				) {
					const revocationParts = revocationService.serviceEndpoint.split(",");
					if (revocationParts.length === 2) {
						const compressedRevocationBytes = Converter.base64UrlToBytes(revocationParts[1]);
						const decompressed = await Compression.decompress(compressedRevocationBytes, "gzip");

						const bitString = BitString.fromBits(
							decompressed,
							EntityStorageIdentityConnector.REVOCATION_BITS_SIZE
						);

						return bitString.getBit(revocationIndex);
					}
				}
			}
		}
		return false;
	}

	/**
	 * Verify the document in storage.
	 * @param requestContext The context for the request.
	 * @param didIdentityDocument The did document that was stored.
	 */
	private async verifyDocument(
		requestContext: IRequestContext,
		didIdentityDocument: IIdentityDocument
	): Promise<void> {
		const stringifiedDocument = didIdentityDocument.document;
		const docBytes = Converter.bytesToBase64(Converter.utf8ToBytes(stringifiedDocument));

		const verified = await this._vaultConnector.verify(
			requestContext,
			didIdentityDocument.id,
			docBytes,
			didIdentityDocument.signature
		);

		if (!verified) {
			throw new GeneralError(
				EntityStorageIdentityConnector._CLASS_NAME,
				"signatureVerificationFailed"
			);
		}
	}

	/**
	 * Update the document in storage.
	 * @param requestContext The context for the request.
	 * @param didDocument The did document to store.
	 */
	private async updateDocument(
		requestContext: IRequestContext,
		didDocument: IDidDocument
	): Promise<void> {
		const stringifiedDocument = JSON.stringify(didDocument);
		const docBytes = Converter.bytesToBase64(Converter.utf8ToBytes(stringifiedDocument));

		const signature = await this._vaultConnector.sign(requestContext, didDocument.id, docBytes);

		await this._didDocumentEntityStorage.set(requestContext, {
			id: didDocument.id,
			document: stringifiedDocument,
			signature
		});
	}
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	BitString,
	Coerce,
	Compression,
	CompressionType,
	Converter,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@gtsc/core";
import { Sha256 } from "@gtsc/crypto";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@gtsc/entity-storage-models";
import type { IIdentityConnector } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import type { IServiceRequestContext } from "@gtsc/services";
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@gtsc/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType, type IVaultConnector } from "@gtsc/vault-models";
import { Jwt, type IJwk, type IJwtHeader, type IJwtPayload } from "@gtsc/web";
import type { IdentityDocument } from "./entities/identityDocument";

/**
 * Class for performing identity operations using entity storage.
 */
export class EntityStorageIdentityConnector implements IIdentityConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "entity-storage";

	/**
	 * The size of the revocation bitmap in bits (16Kb).
	 * @internal
	 */
	private static readonly _REVOCATION_BITS_SIZE: number = 131072;

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<EntityStorageIdentityConnector>();

	/**
	 * The entity storage for identities.
	 * @internal
	 */
	private readonly _didDocumentEntityStorage: IEntityStorageConnector<IdentityDocument>;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * Create a new instance of EntityStorageIdentityConnector.
	 * @param options The dependencies for the identity connector.
	 * @param options.didDocumentEntityStorageType The entity storage for the did documents, defaults to "identity-document".
	 * @param options.vaultConnectorType The vault for the private keys, defaults to "vault".
	 */
	constructor(options?: { didDocumentEntityStorageType?: string; vaultConnectorType?: string }) {
		this._didDocumentEntityStorage = EntityStorageConnectorFactory.get(
			options?.didDocumentEntityStorageType ?? "identity-document"
		);
		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");
	}

	/**
	 * Create a new document.
	 * @param controller The controller for the document.
	 * @param requestContext The context for the request.
	 * @returns The created document.
	 */
	public async createDocument(
		controller: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const did = `did:${EntityStorageIdentityConnector.NAMESPACE}:${Converter.bytesToHex(RandomHelper.generate(32), true)}`;

			// We use a new request context with the identity set to the did so that
			// the vault connector can associate the new keys with the created identity.
			const identityContext: IServiceRequestContext = {
				partitionId: requestContext?.partitionId,
				userIdentity: did
			};

			await this._vaultConnector.createKey(did, VaultKeyType.Ed25519, identityContext);

			const bitString = new BitString(EntityStorageIdentityConnector._REVOCATION_BITS_SIZE);
			const compressed = await Compression.compress(bitString.getBits(), CompressionType.Gzip);

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

			await this.updateDocument(didDocument, controller, identityContext);

			return didDocument;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createDocumentFailed", undefined, error);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @param requestContext The context for the request.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(
		documentId: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);

			return JSON.parse(didIdentityDocument.document) as IDidDocument;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "resolveDocumentFailed", undefined, error);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @param requestContext The context for the request.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.arrayOneOf<DidVerificationMethodType>(
			this.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);

			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const tempKeyId = `temp-${Converter.bytesToBase64Url(RandomHelper.generate(32))}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				tempKeyId,
				VaultKeyType.Ed25519,
				requestContext
			);

			const jwkParams: IJwk = {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: Converter.bytesToBase64Url(verificationPublicKey)
			};

			const kid = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const methodId = `${documentId}#${verificationMethodId ?? kid}`;

			await this._vaultConnector.renameKey(tempKeyId, methodId, requestContext);

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

			await this.updateDocument(didDocument, didIdentityDocument.controller, requestContext);

			return didVerificationMethod;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "addVerificationMethodFailed", undefined, error);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		verificationMethodId: string,
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);

			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);
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
					this.CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			await this.updateDocument(didDocument, didIdentityDocument.controller, requestContext);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeVerificationMethodFailed", undefined, error);
		}
	}

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @param requestContext The context for the request.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string,
		requestContext?: IServiceRequestContext
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const fullServiceId = serviceId.includes("#") ? serviceId : `${documentId}#${serviceId}`;

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === fullServiceId);
				if (existingServiceIndex >= 0) {
					didDocument.service?.splice(existingServiceIndex, 1);
				}
			}

			const didService: IDidService = {
				id: fullServiceId,
				type: serviceType,
				serviceEndpoint
			};

			didDocument.service ??= [];
			didDocument.service.push(didService);

			await this.updateDocument(didDocument, didIdentityDocument.controller, requestContext);

			return didService;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "addServiceFailed", undefined, error);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		serviceId: string,
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const hashIndex = serviceId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", serviceId);
			}

			const documentId = serviceId.slice(0, hashIndex);
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);
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
				throw new NotFoundError(this.CLASS_NAME, "serviceNotFound", serviceId);
			}

			await this.updateDocument(didDocument, didIdentityDocument.controller, requestContext);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeServiceFailed", undefined, error);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param credentialId The id of the credential.
	 * @param types The type for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param contexts Additional contexts to include in the credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @param requestContext The context for the request.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T>(
		verificationMethodId: string,
		credentialId: string | undefined,
		types: string | string[] | undefined,
		subject: T | T[],
		contexts?: string | string[],
		revocationIndex?: number,
		requestContext?: IServiceRequestContext
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		if (!Is.undefined(credentialId)) {
			Guards.stringValue(this.CLASS_NAME, nameof(credentialId), credentialId);
		}
		if (Is.array(types)) {
			Guards.array(this.CLASS_NAME, nameof(types), types);
		} else if (!Is.undefined(types)) {
			Guards.stringValue(this.CLASS_NAME, nameof(types), types);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(this.CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(this.CLASS_NAME, nameof(subject), subject);
		}
		if (Is.array(contexts)) {
			Guards.array(this.CLASS_NAME, nameof(contexts), contexts);
		} else if (!Is.undefined(contexts)) {
			Guards.stringValue(this.CLASS_NAME, nameof(contexts), contexts);
		}
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const issuerDocumentId = verificationMethodId.slice(0, hashIndex);

			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				issuerDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument, requestContext);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing");
			}

			const verificationDidMethod = methodAndArray.method;
			if (!Is.stringValue(verificationDidMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			const revocationService = issuerDidDocument.service?.find(s => s.id.endsWith("#revocation"));

			const finalTypes = ["VerifiableCredential"];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const finalContexts = ["https://www.w3.org/2018/credentials/v1"];
			if (Is.array(contexts)) {
				finalContexts.push(...contexts);
			} else if (Is.stringValue(contexts)) {
				finalContexts.push(contexts);
			}

			const verifiableCredential: IDidVerifiableCredential<T> = {
				"@context": finalContexts,
				id: credentialId,
				type: finalTypes,
				credentialSubject: subject,
				issuer: issuerDidDocument.id,
				issuanceDate: new Date().toISOString(),
				credentialStatus:
					revocationService && !Is.undefined(revocationIndex)
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
					ObjectHelper.propertyDelete(c, "id");
					return c;
				});
			} else {
				ObjectHelper.propertyDelete(jwtVc.credentialSubject, "id");
			}

			const jwtPayload: IJwtPayload = {
				iss: issuerDocumentId,
				nbf: Math.floor(Date.now() / 1000),
				jti: verifiableCredential.id,
				sub: Is.array(subject)
					? ObjectHelper.propertyGet<string>(subject[0], "id")
					: ObjectHelper.propertyGet<string>(subject, "id"),
				vc: jwtVc
			};

			const signature = await Jwt.encodeWithSigner(
				jwtHeader,
				jwtPayload,
				async (alg, key, payload) => {
					const sig = await this._vaultConnector.sign(
						verificationMethodId,
						payload,
						requestContext
					);
					return sig;
				}
			);

			return {
				verifiableCredential,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createVerifiableCredentialFailed", undefined, error);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @param requestContext The context for the request.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T>(
		credentialJwt: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(credentialJwt), credentialJwt);

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
				throw new NotFoundError(this.CLASS_NAME, "jwkSignatureFailed");
			}

			const issuerDocumentId = jwtPayload.iss;
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				issuerDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument, requestContext);
			const issuerDidDocument = JSON.parse(issuerIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === jwtHeader.kid;
				}
				return m.method.id === jwtHeader.kid;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			const verified = Jwt.verifySignature(
				jwtHeader,
				jwtPayload,
				jwtSignature,
				Converter.base64UrlToBytes(didMethod.publicKeyJwk.x)
			);

			if (!verified) {
				throw new GeneralError(this.CLASS_NAME, "jwkSignatureFailed");
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
				this.CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		issuerDocumentId: string,
		credentialIndices: number[],
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				issuerDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument, requestContext);
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
					const decompressed = await Compression.decompress(
						compressedRevocationBytes,
						CompressionType.Gzip
					);

					const bitString = BitString.fromBits(
						decompressed,
						EntityStorageIdentityConnector._REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, true);
					}

					const compressed = await Compression.compress(bitString.getBits(), CompressionType.Gzip);
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			await this.updateDocument(
				issuerDidDocument,
				issuerIdentityDocument.controller,
				requestContext
			);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @param requestContext The context for the request.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		issuerDocumentId: string,
		credentialIndices: number[],
		requestContext?: IServiceRequestContext
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(
				issuerDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument, requestContext);
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
					const decompressed = await Compression.decompress(
						compressedRevocationBytes,
						CompressionType.Gzip
					);

					const bitString = BitString.fromBits(
						decompressed,
						EntityStorageIdentityConnector._REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, false);
					}

					const compressed = await Compression.compress(bitString.getBits(), CompressionType.Gzip);
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			await this.updateDocument(
				issuerDidDocument,
				issuerIdentityDocument.controller,
				requestContext
			);
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param contexts Additional contexts to include in the presentation.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @param requestContext The context for the request.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		presentationMethodId: string,
		types: string | string[] | undefined,
		verifiableCredentials: string[],
		contexts?: string | string[],
		expiresInMinutes?: number,
		requestContext?: IServiceRequestContext
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(presentationMethodId), presentationMethodId);
		if (Is.array(types)) {
			Guards.arrayValue(this.CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(this.CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(this.CLASS_NAME, nameof(verifiableCredentials), verifiableCredentials);
		if (Is.array(contexts)) {
			Guards.arrayValue(this.CLASS_NAME, nameof(contexts), contexts);
		} else if (Is.string(contexts)) {
			Guards.stringValue(this.CLASS_NAME, nameof(contexts), contexts);
		}
		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(this.CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}

		try {
			const hashIndex = presentationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", presentationMethodId);
			}

			const holderDocumentId = presentationMethodId.slice(0, hashIndex);
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(
				holderDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", holderDocumentId);
			}
			await this.verifyDocument(holderIdentityDocument, requestContext);
			const holderDidDocument = JSON.parse(holderIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(holderDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === presentationMethodId;
				}
				return m.method.id === presentationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			const finalTypes = ["VerifiablePresentation"];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const finalContexts = ["https://www.w3.org/2018/credentials/v1"];
			if (Is.array(contexts)) {
				finalContexts.push(...contexts);
			} else if (Is.stringValue(contexts)) {
				finalContexts.push(contexts);
			}

			const verifiablePresentation: IDidVerifiablePresentation = {
				"@context": finalContexts,
				type: finalTypes,
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

			const signature = await Jwt.encodeWithSigner(
				jwtHeader,
				jwtPayload,
				async (alg, key, payload) => {
					const sig = await this._vaultConnector.sign(
						presentationMethodId,
						payload,
						requestContext
					);
					return sig;
				}
			);

			return {
				verifiablePresentation,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(
				this.CLASS_NAME,
				"createVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable presentation is valid.
	 * @param presentationJwt The presentation to verify.
	 * @param requestContext The context for the request.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async checkVerifiablePresentation(
		presentationJwt: string,
		requestContext?: IServiceRequestContext
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(presentationJwt), presentationJwt);

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
				throw new NotFoundError(this.CLASS_NAME, "jwkSignatureFailed");
			}

			const holderDocumentId = jwtPayload.iss;
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(
				holderDocumentId,
				undefined,
				requestContext
			);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", holderDocumentId);
			}
			await this.verifyDocument(holderIdentityDocument, requestContext);

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
							issuerDocumentId,
							undefined,
							requestContext
						);
						if (Is.undefined(issuerDidDocument)) {
							throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
						}
						await this.verifyDocument(issuerDidDocument, requestContext);
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
				this.CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @param requestContext The context for the request.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		verificationMethodId: string,
		bytes: Uint8Array,
		requestContext?: IServiceRequestContext
	): Promise<{
		type: string;
		value: Uint8Array;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);

			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(didDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			const signature = await this._vaultConnector.sign(
				verificationMethodId,
				bytes,
				requestContext
			);

			return {
				type: "Ed25519",
				value: signature
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createProofFailed", undefined, error);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to verify.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @param requestContext The context for the request.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		verificationMethodId: string,
		bytes: Uint8Array,
		signatureType: string,
		signatureValue: Uint8Array,
		requestContext?: IServiceRequestContext
	): Promise<boolean> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(this.CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(this.CLASS_NAME, nameof(signatureValue), signatureValue);

		try {
			const hashIndex = verificationMethodId.indexOf("#");
			if (hashIndex <= 0) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const documentId = verificationMethodId.slice(0, hashIndex);
			const didIdentityDocument = await this._didDocumentEntityStorage.get(
				documentId,
				undefined,
				requestContext
			);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument, requestContext);
			const didDocument = JSON.parse(didIdentityDocument.document) as IDidDocument;

			const methods = this.getAllMethods(didDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing");
			}

			return this._vaultConnector.verify(
				verificationMethodId,
				bytes,
				signatureValue,
				requestContext
			);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "verifyProofFailed", undefined, error);
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

		const methodTypes: DidVerificationMethodType[] = Object.values(DidVerificationMethodType);

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
						const decompressed = await Compression.decompress(
							compressedRevocationBytes,
							CompressionType.Gzip
						);

						const bitString = BitString.fromBits(
							decompressed,
							EntityStorageIdentityConnector._REVOCATION_BITS_SIZE
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
	 * @param didIdentityDocument The did document that was stored.
	 * @param requestContext The context for the request.
	 * @internal
	 */
	private async verifyDocument(
		didIdentityDocument: IdentityDocument,
		requestContext?: IServiceRequestContext
	): Promise<void> {
		const stringifiedDocument = didIdentityDocument.document;
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const verified = await this._vaultConnector.verify(
			didIdentityDocument.id,
			docBytes,
			Converter.base64ToBytes(didIdentityDocument.signature),
			requestContext
		);

		if (!verified) {
			throw new GeneralError(this.CLASS_NAME, "signatureVerificationFailed");
		}
	}

	/**
	 * Update the document in storage.
	 * @param didDocument The did document to store.
	 * @param controller The controller of the document.
	 * @param requestContext The context for the request.
	 * @internal
	 */
	private async updateDocument(
		didDocument: IDidDocument,
		controller: string,
		requestContext?: IServiceRequestContext
	): Promise<void> {
		const stringifiedDocument = JSON.stringify(didDocument);
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const signature = await this._vaultConnector.sign(didDocument.id, docBytes, requestContext);

		await this._didDocumentEntityStorage.set(
			{
				id: didDocument.id,
				document: stringifiedDocument,
				signature: Converter.bytesToBase64(signature),
				controller
			},
			requestContext
		);
	}
}

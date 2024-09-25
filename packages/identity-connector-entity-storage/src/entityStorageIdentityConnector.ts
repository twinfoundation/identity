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
	JsonHelper,
	NotFoundError,
	ObjectHelper,
	RandomHelper
} from "@twin.org/core";
import { Sha256 } from "@twin.org/crypto";
import {
	JsonLdProcessor,
	type IJsonLdContextDefinitionRoot,
	type IJsonLdObject
} from "@twin.org/data-json-ld";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidContexts,
	DidTypes,
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType, type IVaultConnector } from "@twin.org/vault-models";
import { Jwt, type IJwk, type IJwtHeader, type IJwtPayload } from "@twin.org/web";
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
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created document.
	 */
	public async createDocument(controller: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);

		try {
			const did = `did:${EntityStorageIdentityConnector.NAMESPACE}:${Converter.bytesToHex(RandomHelper.generate(32), true)}`;

			await this._vaultConnector.createKey(this.buildVaultKey(did, did), VaultKeyType.Ed25519);

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

			await this.updateDocument(controller, didDocument);

			return didDocument;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createDocumentFailed", undefined, error);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument);

			return didIdentityDocument.document;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "resolveDocumentFailed", undefined, error);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param controller The controller of the identity who can make changes.
	 * @param documentId The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		controller: string,
		documentId: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.arrayOneOf<DidVerificationMethodType>(
			this.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument);

			const didDocument = didIdentityDocument.document;

			const tempKeyId = `temp-${Converter.bytesToBase64Url(RandomHelper.generate(32))}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				this.buildVaultKey(didDocument.id, tempKeyId),
				VaultKeyType.Ed25519
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

			await this._vaultConnector.renameKey(
				this.buildVaultKey(didDocument.id, tempKeyId),
				this.buildVaultKey(didDocument.id, methodId)
			);

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

			await this.updateDocument(controller, didDocument);

			return didVerificationMethod;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "addVerificationMethodFailed", undefined, error);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The id of the verification method.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		controller: string,
		verificationMethodId: string
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(didIdentityDocument);
			const didDocument = didIdentityDocument.document;

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

			await this.updateDocument(controller, didDocument);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeVerificationMethodFailed", undefined, error);
		}
	}

	/**
	 * Add a service to the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param documentId The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		controller: string,
		documentId: string,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await this.verifyDocument(didIdentityDocument);
			const didDocument = didIdentityDocument.document;

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

			await this.updateDocument(controller, didDocument);

			return didService;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "addServiceFailed", undefined, error);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param controller The controller of the identity who can make changes.
	 * @param serviceId The id of the service.
	 * @returns Nothing.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(controller: string, serviceId: string): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const idParts = DocumentHelper.parse(serviceId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", serviceId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(didIdentityDocument);
			const didDocument = didIdentityDocument.document;

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

			await this.updateDocument(controller, didDocument);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "removeServiceFailed", undefined, error);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param id The id of the credential.
	 * @param credential The credential to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends IJsonLdObject>(
		controller: string,
		verificationMethodId: string,
		id: string | undefined,
		credential: T,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.object<IJsonLdObject>(this.CLASS_NAME, nameof(credential), credential);
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(issuerIdentityDocument);
			const issuerDidDocument = issuerIdentityDocument.document;

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

			const finalTypes: string[] = [DidTypes.VerifiableCredential];
			const credContext = ObjectHelper.extractProperty<IJsonLdContextDefinitionRoot>(credential, [
				"@context"
			]);
			const credId = ObjectHelper.extractProperty<string>(credential, ["@id", "id"], false);
			const credType = ObjectHelper.extractProperty<string>(credential, ["@type", "type"]);
			if (Is.stringValue(credType)) {
				finalTypes.push(credType);
			}

			const verifiableCredential: IDidVerifiableCredential<T> = {
				"@context": JsonLdProcessor.combineContexts(DidContexts.ContextV1, credContext) ?? null,
				id,
				type: finalTypes,
				credentialSubject: credential,
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
				iss: idParts.id,
				nbf: Math.floor(Date.now() / 1000),
				jti: verifiableCredential.id,
				sub: credId,
				vc: jwtVc
			};

			const signature = await Jwt.encodeWithSigner(
				jwtHeader,
				jwtPayload,
				async (alg, key, payload) => {
					const sig = await this._vaultConnector.sign(
						this.buildVaultKey(idParts.id, verificationMethodId),
						payload
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
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T extends IJsonLdObject>(
		credentialJwt: string
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
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(issuerDocumentId);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument);
			const issuerDidDocument = issuerIdentityDocument.document;

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

			const verifiableCredential = jwtPayload.vc as IDidVerifiableCredential;
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
				verifiableCredential: revoked
					? undefined
					: (verifiableCredential as IDidVerifiableCredential<T>)
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
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		controller: string,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(issuerDocumentId);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument);
			const issuerDidDocument = issuerIdentityDocument.document;

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

			await this.updateDocument(controller, issuerDidDocument);
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
	 * @param controller The controller of the identity who can make changes.
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param credentialIndices The revocation bitmap index or indices to un revoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		controller: string,
		issuerDocumentId: string,
		credentialIndices: number[]
	): Promise<void> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(issuerDocumentId), issuerDocumentId);
		Guards.arrayValue(this.CLASS_NAME, nameof(credentialIndices), credentialIndices);

		try {
			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(issuerDocumentId);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
			}
			await this.verifyDocument(issuerIdentityDocument);
			const issuerDidDocument = issuerIdentityDocument.document;

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

			await this.updateDocument(controller, issuerDidDocument);
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
	 * @param controller The controller of the identity who can make changes.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation<T extends IJsonLdObject>(
		controller: string,
		presentationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential<T>)[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation<T>;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(presentationMethodId), presentationMethodId);
		if (Is.array(types)) {
			Guards.arrayValue(this.CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(this.CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(this.CLASS_NAME, nameof(verifiableCredentials), verifiableCredentials);
		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(this.CLASS_NAME, nameof(expiresInMinutes), expiresInMinutes);
		}

		try {
			const idParts = DocumentHelper.parse(presentationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", presentationMethodId);
			}

			const holderIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(holderIdentityDocument);
			const holderDidDocument = holderIdentityDocument.document;

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

			const finalTypes: string[] = [DidTypes.VerifiablePresentation];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const verifiablePresentation: IDidVerifiablePresentation<T> = {
				"@context": JsonLdProcessor.combineContexts(DidContexts.ContextV1, contexts) ?? null,
				id: presentationId,
				type: finalTypes,
				verifiableCredential: verifiableCredentials,
				holder: idParts.id
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
				iss: idParts.id,
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
						this.buildVaultKey(idParts.id, presentationMethodId),
						payload
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
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async checkVerifiablePresentation<T extends IJsonLdObject>(
		presentationJwt: string
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation<T>;
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
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(holderDocumentId);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", holderDocumentId);
			}
			await this.verifyDocument(holderIdentityDocument);

			const issuers: IDidDocument[] = [];
			const tokensRevoked: boolean[] = [];
			const verifiablePresentation = jwtPayload?.vp as IDidVerifiablePresentation<T>;
			if (
				Is.object<IDidVerifiablePresentation>(verifiablePresentation) &&
				Is.array(verifiablePresentation.verifiableCredential)
			) {
				for (const vcJwt of verifiablePresentation.verifiableCredential) {
					let revoked = true;
					if (Is.stringValue(vcJwt)) {
						const jwt = await Jwt.decode(vcJwt);

						if (Is.string(jwt.payload?.iss)) {
							const issuerDocumentId = jwt.payload.iss;
							verifiablePresentation.holder = issuerDocumentId;

							const issuerDidDocument = await this._didDocumentEntityStorage.get(issuerDocumentId);
							if (Is.undefined(issuerDidDocument)) {
								throw new NotFoundError(this.CLASS_NAME, "documentNotFound", issuerDocumentId);
							}
							await this.verifyDocument(issuerDidDocument);
							issuers.push(issuerDidDocument);

							const vc = jwt.payload.vc as IDidVerifiableCredential;
							if (Is.object<IDidVerifiableCredential>(vc)) {
								revoked = await this.checkRevocation(
									issuerDidDocument,
									vc.credentialStatus?.revocationBitmapIndex
								);
							}
						}
					} else {
						revoked = false;
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
	 * @param controller The controller of the identity who can make changes.
	 * @param verificationMethodId The verification method id to use.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		controller: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(didIdentityDocument);
			const didDocument = didIdentityDocument.document;

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
				this.buildVaultKey(didDocument.id, verificationMethodId),
				bytes
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
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		verificationMethodId: string,
		bytes: Uint8Array,
		signatureType: string,
		signatureValue: Uint8Array
	): Promise<boolean> {
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);
		Guards.stringValue(this.CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(this.CLASS_NAME, nameof(signatureValue), signatureValue);

		try {
			const idParts = DocumentHelper.parse(verificationMethodId);
			if (Is.empty(idParts.hash)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await this.verifyDocument(didIdentityDocument);
			const didDocument = didIdentityDocument.document;

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
				this.buildVaultKey(didIdentityDocument.id, verificationMethodId),
				bytes,
				signatureValue
			);
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "verifyProofFailed", undefined, error);
		}
	}

	/**
	 * Get all the methods from a document.
	 * @param document The document to get the methods from.
	 * @returns The methods.
	 * @internal
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
	 * @internal
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
	 * @param didDocument The did document that was stored.
	 * @internal
	 */
	private async verifyDocument(didDocument: IdentityDocument): Promise<void> {
		const stringifiedDocument = JsonHelper.canonicalize(didDocument.document);
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const verified = await this._vaultConnector.verify(
			this.buildVaultKey(didDocument.id, didDocument.id),
			docBytes,
			Converter.base64ToBytes(didDocument.signature)
		);

		if (!verified) {
			throw new GeneralError(this.CLASS_NAME, "signatureVerificationFailed");
		}
	}

	/**
	 * Update the document in storage.
	 * @param controller The controller of the document.
	 * @param didDocument The did document to store.
	 * @internal
	 */
	private async updateDocument(controller: string, didDocument: IDidDocument): Promise<void> {
		const stringifiedDocument = JsonHelper.canonicalize(didDocument);
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const signature = await this._vaultConnector.sign(
			this.buildVaultKey(didDocument.id, didDocument.id),
			docBytes
		);

		await this._didDocumentEntityStorage.set({
			id: didDocument.id,
			document: didDocument,
			signature: Converter.bytesToBase64(signature),
			controller
		});
	}

	/**
	 * Build the key name to access the specified key in the vault.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The vault key.
	 * @internal
	 */
	private buildVaultKey(identity: string, key: string): string {
		return `${identity}/${key}`;
	}
}

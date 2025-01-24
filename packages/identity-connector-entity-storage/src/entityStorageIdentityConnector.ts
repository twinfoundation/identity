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
	type IJsonLdNodeObject
} from "@twin.org/data-json-ld";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import { DocumentHelper, type IIdentityConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	DidContexts,
	DidCryptoSuites,
	DidTypes,
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidProof,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@twin.org/standards-w3c-did";
import { type IVaultConnector, VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import { Jwt, type IJwk, type IJwtHeader, type IJwtPayload } from "@twin.org/web";
import type { IdentityDocument } from "./entities/identityDocument";
import type { EntityStorageIdentityResolverConnector } from "./entityStorageIdentityResolverConnector";
import type { IEntityStorageIdentityConnectorConstructorOptions } from "./models/IEntityStorageIdentityConnectorConstructorOptions";

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
	protected readonly _didDocumentEntityStorage: IEntityStorageConnector<IdentityDocument>;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	protected readonly _vaultConnector: IVaultConnector;

	/**
	 * Create a new instance of EntityStorageIdentityConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options?: IEntityStorageIdentityConnectorConstructorOptions) {
		this._didDocumentEntityStorage = EntityStorageConnectorFactory.get(
			options?.didDocumentEntityStorageType ?? "identity-document"
		);
		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");
	}

	/**
	 * Build the key name to access the specified key in the vault.
	 * @param identity The identity of the user to access the vault keys.
	 * @returns The vault key.
	 * @internal
	 */
	public static buildVaultKey(identity: string, key: string): string {
		return `${identity}/${key}`;
	}

	/**
	 * Verify the document in storage.
	 * @param didDocument The did document that was stored.
	 * @internal
	 */
	public static async verifyDocument(
		didDocument: IdentityDocument,
		vaultConnector: IVaultConnector
	): Promise<void> {
		const stringifiedDocument = JsonHelper.canonicalize(didDocument.document);
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const verified = await vaultConnector.verify(
			EntityStorageIdentityConnector.buildVaultKey(didDocument.id, "did"),
			docBytes,
			Converter.base64ToBytes(didDocument.signature)
		);

		if (!verified) {
			throw new GeneralError(
				nameof<EntityStorageIdentityResolverConnector>(),
				"signatureVerificationFailed"
			);
		}
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

			await this._vaultConnector.createKey(
				EntityStorageIdentityConnector.buildVaultKey(did, "did"),
				VaultKeyType.Ed25519
			);

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
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);

			const didDocument = didIdentityDocument.document;

			const tempKeyId = `temp-vm-${Converter.bytesToBase64Url(RandomHelper.generate(16))}`;
			const verificationPublicKey = await this._vaultConnector.createKey(
				EntityStorageIdentityConnector.buildVaultKey(didDocument.id, tempKeyId),
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
				EntityStorageIdentityConnector.buildVaultKey(didDocument.id, tempKeyId),
				EntityStorageIdentityConnector.buildVaultKey(didDocument.id, verificationMethodId ?? kid)
			);

			const methods = this.getAllMethods(didDocument);
			const existingMethodIndex = methods.findIndex(m => {
				if (Is.string(m.method)) {
					return m.method === methodId;
				}
				return m.method.id === methodId;
			});

			if (existingMethodIndex !== -1) {
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
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);
			const didDocument = didIdentityDocument.document;

			const methods = this.getAllMethods(didDocument);
			const existingMethodIndex = methods.findIndex(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (existingMethodIndex !== -1) {
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
		serviceType: string | string[],
		serviceEndpoint: string | string[]
	): Promise<IDidService> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);
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

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);
			const didDocument = didIdentityDocument.document;

			const fullServiceId = serviceId.includes("#") ? serviceId : `${documentId}#${serviceId}`;

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === fullServiceId);
				if (existingServiceIndex !== -1) {
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
			const idParts = DocumentHelper.parseId(serviceId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", serviceId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);
			const didDocument = didIdentityDocument.document;

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === serviceId);
				if (existingServiceIndex !== -1) {
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
	 * @param subject The credential subject to store in the verifiable credential.
	 * @param revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential(
		controller: string,
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		revocationIndex?: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.object<IJsonLdNodeObject>(this.CLASS_NAME, nameof(subject), subject);
		if (!Is.undefined(revocationIndex)) {
			Guards.number(this.CLASS_NAME, nameof(revocationIndex), revocationIndex);
		}

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const issuerIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(issuerIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				issuerIdentityDocument,
				this._vaultConnector
			);
			const issuerDidDocument = issuerIdentityDocument.document;

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const verificationDidMethod = methodAndArray.method;
			if (!Is.stringValue(verificationDidMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: verificationMethodId
				});
			}

			const revocationService = issuerDidDocument.service?.find(s => s.id.endsWith("#revocation"));

			const subjectClone = ObjectHelper.clone(subject);

			const finalTypes: string[] = [DidTypes.VerifiableCredential];
			const credContext = ObjectHelper.extractProperty<IJsonLdContextDefinitionRoot>(subjectClone, [
				"@context"
			]);
			const credId = ObjectHelper.extractProperty<string>(subjectClone, ["@id", "id"], false);
			const credType = ObjectHelper.extractProperty<string>(subjectClone, ["@type", "type"]);
			if (Is.stringValue(credType)) {
				finalTypes.push(credType);
			}

			const verifiableCredential: IDidVerifiableCredential = {
				"@context": JsonLdProcessor.combineContexts(DidContexts.ContextVCv2, credContext) as [
					typeof DidContexts.ContextVCv2
				],
				id,
				type: finalTypes,
				credentialSubject: subjectClone,
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
						EntityStorageIdentityConnector.buildVaultKey(idParts.id, idParts.fragment ?? ""),
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
	public async checkVerifiableCredential(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
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
			await EntityStorageIdentityConnector.verifyDocument(
				issuerIdentityDocument,
				this._vaultConnector
			);
			const issuerDidDocument = issuerIdentityDocument.document;

			const methods = this.getAllMethods(issuerDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === jwtHeader.kid;
				}
				return m.method.id === jwtHeader.kid;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: jwtHeader.kid });
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", { method: jwtHeader.kid });
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
			await EntityStorageIdentityConnector.verifyDocument(
				issuerIdentityDocument,
				this._vaultConnector
			);
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
			await EntityStorageIdentityConnector.verifyDocument(
				issuerIdentityDocument,
				this._vaultConnector
			);
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
	 * @param verificationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiablePresentation(
		controller: string,
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
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
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

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const holderIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				holderIdentityDocument,
				this._vaultConnector
			);
			const holderDidDocument = holderIdentityDocument.document;

			const methods = this.getAllMethods(holderDidDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: verificationMethodId
				});
			}

			const finalTypes: string[] = [DidTypes.VerifiablePresentation];
			if (Is.array(types)) {
				finalTypes.push(...types);
			} else if (Is.stringValue(types)) {
				finalTypes.push(types);
			}

			const verifiablePresentation: IDidVerifiablePresentation = {
				"@context": JsonLdProcessor.combineContexts(DidContexts.ContextVCv2, contexts) as [
					typeof DidContexts.ContextVCv2
				],
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
						EntityStorageIdentityConnector.buildVaultKey(idParts.id, idParts.fragment ?? ""),
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
	public async checkVerifiablePresentation(presentationJwt: string): Promise<{
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
			const holderIdentityDocument = await this._didDocumentEntityStorage.get(holderDocumentId);
			if (Is.undefined(holderIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", holderDocumentId);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				holderIdentityDocument,
				this._vaultConnector
			);

			const issuers: IDidDocument[] = [];
			const tokensRevoked: boolean[] = [];
			const verifiablePresentation = jwtPayload?.vp as IDidVerifiablePresentation;
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
							await EntityStorageIdentityConnector.verifyDocument(
								issuerDidDocument,
								this._vaultConnector
							);
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
	 * @returns The proof.
	 */
	public async createProof(
		controller: string,
		verificationMethodId: string,
		bytes: Uint8Array
	): Promise<IDidProof> {
		Guards.stringValue(this.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(this.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", verificationMethodId);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);
			const didDocument = didIdentityDocument.document;

			const methods = this.getAllMethods(didDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", { method: verificationMethodId });
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: verificationMethodId
				});
			}

			const signature = await this._vaultConnector.sign(
				EntityStorageIdentityConnector.buildVaultKey(didDocument.id, idParts.fragment ?? ""),
				bytes
			);

			return {
				"@context": DidContexts.ContextVCDataIntegrity,
				type: DidTypes.DataIntegrityProof,
				cryptosuite: DidCryptoSuites.EdDSAJcs2022,
				created: new Date(Date.now()).toISOString(),
				verificationMethod: verificationMethodId,
				proofPurpose: "assertionMethod",
				proofValue: Converter.bytesToBase58(signature)
			};
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "createProofFailed", undefined, error);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param bytes The data bytes to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async verifyProof(bytes: Uint8Array, proof: IDidProof): Promise<boolean> {
		Guards.uint8Array(this.CLASS_NAME, nameof(bytes), bytes);
		Guards.object(this.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.type), proof.type);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.cryptosuite), proof.cryptosuite);
		Guards.stringValue(this.CLASS_NAME, nameof(proof.verificationMethod), proof.verificationMethod);
		Guards.stringBase58(this.CLASS_NAME, nameof(proof.proofValue), proof.proofValue);

		try {
			if (proof.type !== DidTypes.DataIntegrityProof) {
				throw new GeneralError(this.CLASS_NAME, "proofType", { proofType: proof.type });
			}
			if (proof.cryptosuite !== DidCryptoSuites.EdDSAJcs2022) {
				throw new GeneralError(this.CLASS_NAME, "cryptoSuite", { cryptosuite: proof.cryptosuite });
			}
			const idParts = DocumentHelper.parseId(proof.verificationMethod);
			if (Is.empty(idParts.fragment)) {
				throw new NotFoundError(this.CLASS_NAME, "missingDid", proof.verificationMethod);
			}

			const didIdentityDocument = await this._didDocumentEntityStorage.get(idParts.id);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", idParts.id);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);
			const didDocument = didIdentityDocument.document;

			const methods = this.getAllMethods(didDocument);

			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === proof.verificationMethod;
				}
				return m.method.id === proof.verificationMethod;
			});

			if (!methodAndArray) {
				throw new GeneralError(this.CLASS_NAME, "methodMissing", {
					method: proof.verificationMethod
				});
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(this.CLASS_NAME, "publicKeyJwkMissing", {
					method: proof.verificationMethodId
				});
			}

			return this._vaultConnector.verify(
				EntityStorageIdentityConnector.buildVaultKey(didIdentityDocument.id, idParts.fragment),
				bytes,
				Converter.base58ToBytes(proof.proofValue)
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
	 * Update the document in storage.
	 * @param controller The controller of the document.
	 * @param didDocument The did document to store.
	 * @internal
	 */
	private async updateDocument(controller: string, didDocument: IDidDocument): Promise<void> {
		const stringifiedDocument = JsonHelper.canonicalize(didDocument);
		const docBytes = Converter.utf8ToBytes(stringifiedDocument);

		const signature = await this._vaultConnector.sign(
			EntityStorageIdentityConnector.buildVaultKey(didDocument.id, "did"),
			docBytes
		);

		await this._didDocumentEntityStorage.set({
			id: didDocument.id,
			document: didDocument,
			signature: Converter.bytesToBase64(signature),
			controller
		});
	}
}

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
import { Ed25519, Sha256 } from "@gtsc/crypto";
import type {
	IDidDocument,
	IDidDocumentVerificationMethod,
	IDidVerifiableCredential,
	IDidVerifiablePresentation,
	IIdentityProvider
} from "@gtsc/identity-provider-models";
import { nameof } from "@gtsc/nameof";
import { Jwt, type IJwk, type IJwtHeader, type IJwtPayload } from "@gtsc/web";
import type { IMemoryIdentityProviderConfig } from "./models/IMemoryIdentityProviderConfig";

/**
 * Class for performing identity operations using in-memory storage.
 */
export class MemoryIdentityProvider implements IIdentityProvider {
	/**
	 * The namespace supported by the identity provider.
	 */
	public static NAMESPACE: string = "mem";

	/**
	 * The size of the revocation bitmap in bits (16Kb).
	 */
	public static REVOCATION_BITS_SIZE: number = 131072;

	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<MemoryIdentityProvider>();

	/**
	 * The memory storage for the identities.
	 * @internal
	 */
	private readonly _store: { [id: string]: IDidDocument };

	/**
	 * Create a new instance of MemoryIdentityProvider.
	 * @param config The configuration for the identity provider.
	 */
	constructor(config?: IMemoryIdentityProviderConfig) {
		this._store = config?.initialValues ?? {};
	}

	/**
	 * Create a new document from the key pair.
	 * @param documentPrivateKey The private key to use in generating the document.
	 * @param documentPublicKey The public key to use in generating the document.
	 * @returns The created document.
	 */
	public async createDocument(
		documentPrivateKey: Uint8Array,
		documentPublicKey: Uint8Array
	): Promise<IDidDocument> {
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPublicKey),
			documentPublicKey
		);

		try {
			const did = `did:mem:${Converter.bytesToHex(RandomHelper.generate(32), true)}`;

			const jwkParams: IJwk = {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: Converter.bytesToBase64Url(documentPublicKey)
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const methodId = `${did}#${fingerPrint}`;

			const bitString = new BitString(MemoryIdentityProvider.REVOCATION_BITS_SIZE);
			const compressed = await Compression.compress(bitString.getBits(), "gzip");

			const didDocument: IDidDocument = {
				id: did,
				assertionMethod: [
					{
						id: methodId,
						controller: did,
						type: "JsonWebKey",
						publicKeyJwk: {
							...jwkParams,
							kid: fingerPrint
						}
					}
				],
				service: [
					{
						id: `${did}#revocation`,
						type: "BitstringStatusList",
						serviceEndpoint: `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`
					}
				]
			};

			this._store[did] = didDocument;

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"createDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);

		try {
			if (Is.undefined(this._store[documentId])) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}
			return this._store[documentId];
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"resolveDocumentFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param documentId The id of the document to add the verification method to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param verificationPublicKey The public key for the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async addVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationPublicKey: Uint8Array
	): Promise<IDidDocument> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verificationPublicKey),
			verificationPublicKey
		);

		try {
			const didDocument = this._store[documentId];
			if (Is.undefined(didDocument)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const jwkParams: IJwk = {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: Converter.bytesToBase64Url(verificationPublicKey)
			};

			const fingerPrint = Converter.bytesToBase64Url(
				Sha256.sum256(Converter.utf8ToBytes(JSON.stringify(jwkParams)))
			);

			const methodId = `${documentId}#${fingerPrint}`;

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

			didDocument.verificationMethod ??= [];
			didDocument.verificationMethod.push({
				id: methodId,
				controller: documentId,
				type: "JsonWebKey",
				publicKeyJwk: {
					...jwkParams,
					kid: fingerPrint
				}
			});

			this._store[documentId] = didDocument;

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"addVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a verification method from the document.
	 * @param documentId The id of the document to remove the verification method from.
	 * @param documentPrivateKey The key required to sign the updated document.
	 * @param verificationMethodId The id of the verification method.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async removeVerificationMethod(
		documentId: string,
		documentPrivateKey: Uint8Array,
		verificationMethodId: string
	): Promise<IDidDocument> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const didDocument = this._store[documentId];
			if (Is.undefined(didDocument)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

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
					MemoryIdentityProvider._CLASS_NAME,
					"verificationMethodNotFound",
					verificationMethodId
				);
			}

			this._store[documentId] = didDocument;

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"removeVerificationMethodFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Add a service to the document.
	 * @param documentId The id of the document to add the service to.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async addService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string,
		serviceType: string,
		serviceEndpoint: string
	): Promise<IDidDocument> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(serviceId), serviceId);
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(serviceType), serviceType);
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(serviceEndpoint),
			serviceEndpoint
		);

		try {
			const didDocument = this._store[documentId];
			if (Is.undefined(didDocument)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === serviceId);
				if (existingServiceIndex >= 0) {
					didDocument.service?.splice(existingServiceIndex, 1);
				}
			}

			didDocument.service ??= [];
			didDocument.service.push({
				id: serviceId,
				type: serviceType,
				serviceEndpoint
			});

			this._store[documentId] = didDocument;

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"addServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param documentId The id of the document to remove the service from.
	 * @param documentPrivateKey The private key required to sign the updated document.
	 * @param serviceId The id of the service.
	 * @returns The updated document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async removeService(
		documentId: string,
		documentPrivateKey: Uint8Array,
		serviceId: string
	): Promise<IDidDocument> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(documentPrivateKey),
			documentPrivateKey
		);
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const didDocument = this._store[documentId];
			if (Is.undefined(didDocument)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			if (Is.array(didDocument.service)) {
				const existingServiceIndex = didDocument.service.findIndex(s => s.id === serviceId);
				if (existingServiceIndex >= 0) {
					didDocument.service?.splice(existingServiceIndex, 1);
				}
			} else {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "serviceNotFound", serviceId);
			}

			this._store[documentId] = didDocument;

			return didDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"removeServiceFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable credential for a verification method.
	 * @param issuerDocumentId The id of the document issuing the verifiable credential.
	 * @param assertionMethodId The assertion id to use.
	 * @param assertionMethodPrivateKey The private key required to generate the verifiable credential.
	 * @param credentialId The id of the credential.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param subject The subject data to store for the credential.
	 * @param revocationIndex The bitmap revocation index of the credential.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async createVerifiableCredential<T extends { id?: string }>(
		issuerDocumentId: string,
		assertionMethodId: string,
		assertionMethodPrivateKey: Uint8Array,
		credentialId: string,
		schemaTypes: string | string[],
		subject: T | T[],
		revocationIndex: number
	): Promise<{
		verifiableCredential: IDidVerifiableCredential<T>;
		jwt: string;
	}> {
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(assertionMethodId),
			assertionMethodId
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(assertionMethodPrivateKey),
			assertionMethodPrivateKey
		);
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(credentialId), credentialId);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(MemoryIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		if (Is.array(subject)) {
			Guards.arrayValue<T>(MemoryIdentityProvider._CLASS_NAME, nameof(subject), subject);
		} else {
			Guards.object<T>(MemoryIdentityProvider._CLASS_NAME, nameof(subject), subject);
		}
		Guards.number(MemoryIdentityProvider._CLASS_NAME, nameof(revocationIndex), revocationIndex);

		try {
			const issuerDocument = this._store[issuerDocumentId];
			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const methods = this.getAllMethods(issuerDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === assertionMethodId;
				}
				return m.method.id === assertionMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const revocationService = issuerDocument.service?.find(s => s.id.endsWith("#revocation"));

			const verifiableCredential: IDidVerifiableCredential<T> = {
				"@context": "https://www.w3.org/2018/credentials/v1",
				id: credentialId,
				type: ["VerifiableCredential", ...(Is.array(schemaTypes) ? schemaTypes : [schemaTypes])],
				credentialSubject: subject,
				issuer: issuerDocument.id,
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
				kid: didMethod.id,
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

			const publicKeyBytes = Converter.base64UrlToBytes(didMethod.publicKeyJwk.x);
			const fullPrivateKey = new Uint8Array(
				assertionMethodPrivateKey.length + publicKeyBytes.length
			);
			fullPrivateKey.set(assertionMethodPrivateKey);
			fullPrivateKey.set(publicKeyBytes, assertionMethodPrivateKey.length);

			const signature = Jwt.encode(jwtHeader, jwtPayload, fullPrivateKey);

			return {
				verifiableCredential,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"createVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Check a verifiable credential is valid.
	 * @param credentialJwt The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async checkVerifiableCredential<T>(credentialJwt: string): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential<T>;
	}> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(credentialJwt), credentialJwt);

		try {
			const jwtDecoded = Jwt.decode(credentialJwt);

			const jwtHeader = jwtDecoded.header;
			const jwtPayload = jwtDecoded.payload;
			const jwtSignature = jwtDecoded.signature;

			if (
				Is.undefined(jwtHeader) ||
				Is.undefined(jwtPayload) ||
				Is.undefined(jwtPayload.iss) ||
				Is.undefined(jwtSignature)
			) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "jwkSignatureFailed");
			}

			const issuerDocumentId = jwtPayload.iss;
			const issuerDocument = this._store[issuerDocumentId];
			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const methods = this.getAllMethods(issuerDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === jwtHeader.kid;
				}
				return m.method.id === jwtHeader.kid;
			});

			if (!methodAndArray) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const verified = Jwt.verifySignature(
				jwtHeader,
				jwtPayload,
				jwtSignature,
				Converter.base64UrlToBytes(didMethod.publicKeyJwk.x)
			);

			if (!verified) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "jwkSignatureFailed");
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
				issuerDocument,
				verifiableCredential.credentialStatus?.revocationBitmapIndex
			);

			return {
				revoked,
				verifiableCredential: revoked ? undefined : verifiableCredential
			};
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"checkingVerifiableCredentialFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to revoke.
	 * @returns Nothing.
	 */
	public async revokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument> {
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentPrivateKey),
			issuerDocumentPrivateKey
		);
		Guards.arrayValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const issuerDocument = this._store[issuerDocumentId];
			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const revocationService = issuerDocument.service?.find(s => s.id.endsWith("#revocation"));
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
						MemoryIdentityProvider.REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, true);
					}

					const compressed = await Compression.compress(bitString.getBits(), "gzip");
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			this._store[issuerDocumentId] = issuerDocument;

			return issuerDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"revokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential(s).
	 * @param issuerDocumentId The id of the document to update the revocation list for.
	 * @param issuerDocumentPrivateKey The private key required to sign the updated document.
	 * @param credentialIndices The revocation bitmap index or indices to unrevoke.
	 * @returns Nothing.
	 */
	public async unrevokeVerifiableCredentials(
		issuerDocumentId: string,
		issuerDocumentPrivateKey: Uint8Array,
		credentialIndices: number[]
	): Promise<IDidDocument> {
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentId),
			issuerDocumentId
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(issuerDocumentPrivateKey),
			issuerDocumentPrivateKey
		);
		Guards.arrayValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(credentialIndices),
			credentialIndices
		);

		try {
			const issuerDocument = this._store[issuerDocumentId];
			if (Is.undefined(issuerDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					issuerDocumentId
				);
			}

			const revocationService = issuerDocument.service?.find(s => s.id.endsWith("#revocation"));
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
						MemoryIdentityProvider.REVOCATION_BITS_SIZE
					);

					for (const credentialIndex of credentialIndices) {
						bitString.setBit(credentialIndex, false);
					}

					const compressed = await Compression.compress(bitString.getBits(), "gzip");
					revocationService.serviceEndpoint = `data:application/octet-stream;base64,${Converter.bytesToBase64Url(compressed)}`;
				}
			}

			this._store[issuerDocumentId] = issuerDocument;

			return issuerDocument;
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"unrevokeVerifiableCredentialsFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param holderDocumentId The id of the document creating the verifiable presentation.
	 * @param presentationMethodId The method to associate with the presentation.
	 * @param presentationPrivateKey The private key required to generate the verifiable presentation.
	 * @param schemaTypes The type of the schemas for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param expiresInMinutes The time in minutes for the presentation to expire.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async createVerifiablePresentation(
		holderDocumentId: string,
		presentationMethodId: string,
		presentationPrivateKey: Uint8Array,
		schemaTypes: string | string[],
		verifiableCredentials: string[],
		expiresInMinutes?: number
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(holderDocumentId),
			holderDocumentId
		);

		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(presentationMethodId),
			presentationMethodId
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(presentationPrivateKey),
			presentationPrivateKey
		);
		if (Is.array(schemaTypes)) {
			Guards.arrayValue(MemoryIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		} else {
			Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(schemaTypes), schemaTypes);
		}
		Guards.arrayValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);

		if (!Is.undefined(expiresInMinutes)) {
			Guards.integer(
				MemoryIdentityProvider._CLASS_NAME,
				nameof(expiresInMinutes),
				expiresInMinutes
			);
		}

		try {
			const holderDocument = this._store[holderDocumentId];
			if (Is.undefined(holderDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}

			const methods = this.getAllMethods(holderDocument);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === presentationMethodId;
				}
				return m.method.id === presentationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
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

			const publicKeyBytes = Converter.base64UrlToBytes(didMethod.publicKeyJwk.x);
			const fullPrivateKey = new Uint8Array(presentationPrivateKey.length + publicKeyBytes.length);
			fullPrivateKey.set(presentationPrivateKey);
			fullPrivateKey.set(publicKeyBytes, presentationPrivateKey.length);

			const signature = Jwt.encode(jwtHeader, jwtPayload, fullPrivateKey);

			return {
				verifiablePresentation,
				jwt: signature
			};
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
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
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(presentationJwt),
			presentationJwt
		);

		try {
			const jwtDecoded = Jwt.decode(presentationJwt);

			const jwtHeader = jwtDecoded.header;
			const jwtPayload = jwtDecoded.payload;
			const jwtSignature = jwtDecoded.signature;

			if (
				Is.undefined(jwtHeader) ||
				Is.undefined(jwtPayload) ||
				Is.undefined(jwtPayload.iss) ||
				Is.undefined(jwtSignature)
			) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "jwkSignatureFailed");
			}

			const holderDocumentId = jwtPayload.iss;
			const holderDocument = this._store[holderDocumentId];
			if (Is.undefined(holderDocument)) {
				throw new NotFoundError(
					MemoryIdentityProvider._CLASS_NAME,
					"documentNotFound",
					holderDocumentId
				);
			}

			const issuers: IDidDocument[] = [];
			const tokensRevoked: boolean[] = [];
			const verifiablePresentation = jwtPayload?.vp as IDidVerifiablePresentation;
			if (
				Is.object<IDidVerifiablePresentation>(verifiablePresentation) &&
				Is.array(verifiablePresentation.verifiableCredential)
			) {
				for (const vcJwt of verifiablePresentation.verifiableCredential) {
					const jwt = Jwt.decode(vcJwt);
					let revoked = true;

					if (Is.string(jwt.payload?.iss)) {
						const issuerId = jwt.payload.iss;
						verifiablePresentation.holder = issuerId;

						const issuerDocument = this._store[issuerId];
						if (Is.undefined(issuerDocument)) {
							throw new NotFoundError(
								MemoryIdentityProvider._CLASS_NAME,
								"documentNotFound",
								issuerId
							);
						}
						issuers.push(issuerDocument);

						const vc = jwt.payload.vc as IDidVerifiableCredential;
						if (Is.object<IDidVerifiableCredential>(vc)) {
							revoked = await this.checkRevocation(
								issuerDocument,
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
				MemoryIdentityProvider._CLASS_NAME,
				"checkingVerifiablePresentationFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document signing the data.
	 * @param verificationMethodId The verification method id to use.
	 * @param verificationPrivateKey The private key required to generate the proof.
	 * @param bytes The data bytes to sign.
	 * @returns The proof signature type and value.
	 */
	public async createProof(
		documentId: string,
		verificationMethodId: string,
		verificationPrivateKey: Uint8Array,
		bytes: Uint8Array
	): Promise<{
		type: string;
		value: Uint8Array;
	}> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.uint8Array(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verificationPrivateKey),
			verificationPrivateKey
		);
		Guards.uint8Array(MemoryIdentityProvider._CLASS_NAME, nameof(bytes), bytes);

		try {
			const document = this._store[documentId];
			if (Is.undefined(document)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = this.getAllMethods(document);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const publicKeyBytes = Converter.base64UrlToBytes(didMethod.publicKeyJwk.x);
			const fullPrivateKey = new Uint8Array(verificationPrivateKey.length + publicKeyBytes.length);
			fullPrivateKey.set(verificationPrivateKey);
			fullPrivateKey.set(publicKeyBytes, verificationPrivateKey.length);

			const signature = Ed25519.sign(fullPrivateKey, bytes);

			return {
				type: "Ed25519",
				value: signature
			};
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"createProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Verify proof for arbitrary data with the specified verification method.
	 * @param documentId The id of the document verifying the data.
	 * @param verificationMethodId The verification id method to use.
	 * @param signatureType The type of the signature for the proof.
	 * @param signatureValue The value of the signature for the proof.
	 * @param bytes The data bytes to verify.
	 * @returns True if the signature is valid.
	 */
	public async verifyProof(
		documentId: string,
		verificationMethodId: string,
		signatureType: string,
		signatureValue: Uint8Array,
		bytes: Uint8Array
	): Promise<boolean> {
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(
			MemoryIdentityProvider._CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.stringValue(MemoryIdentityProvider._CLASS_NAME, nameof(signatureType), signatureType);
		Guards.uint8Array(MemoryIdentityProvider._CLASS_NAME, nameof(signatureValue), signatureValue);
		Guards.uint8Array(MemoryIdentityProvider._CLASS_NAME, nameof(bytes), bytes);

		try {
			const document = this._store[documentId];
			if (Is.undefined(document)) {
				throw new NotFoundError(MemoryIdentityProvider._CLASS_NAME, "documentNotFound", documentId);
			}

			const methods = this.getAllMethods(document);
			const methodAndArray = methods.find(m => {
				if (Is.string(m.method)) {
					return m.method === verificationMethodId;
				}
				return m.method.id === verificationMethodId;
			});

			if (!methodAndArray) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "methodMissing");
			}

			const didMethod = methodAndArray.method;
			if (!Is.stringValue(didMethod.publicKeyJwk?.x)) {
				throw new GeneralError(MemoryIdentityProvider._CLASS_NAME, "publicKeyJwkMissing");
			}

			const publicKeyBytes = Converter.base64UrlToBytes(didMethod.publicKeyJwk.x);
			return Ed25519.verify(publicKeyBytes, bytes, signatureValue);
		} catch (error) {
			throw new GeneralError(
				MemoryIdentityProvider._CLASS_NAME,
				"verifyProofFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Get the memory store.
	 * @returns The store.
	 */
	public getStore(): { [id: string]: IDidDocument } {
		return this._store;
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

		if (Is.arrayValue(document.verificationMethod)) {
			methods.push(
				...document.verificationMethod.map(m => ({
					arrayKey: "verificationMethod",
					method: Is.string(m) ? { id: m } : m
				}))
			);
		}
		if (Is.arrayValue(document.authentication)) {
			methods.push(
				...document.authentication.map(m => ({
					arrayKey: "authentication",
					method: Is.string(m) ? { id: m } : m
				}))
			);
		}
		if (Is.arrayValue(document.assertionMethod)) {
			methods.push(
				...document.assertionMethod.map(m => ({
					arrayKey: "assertionMethod",
					method: Is.string(m) ? { id: m } : m
				}))
			);
		}
		if (Is.arrayValue(document.keyAgreement)) {
			methods.push(
				...document.keyAgreement.map(m => ({
					arrayKey: "keyAgreement",
					method: Is.string(m) ? { id: m } : m
				}))
			);
		}
		if (Is.arrayValue(document.capabilityInvocation)) {
			methods.push(
				...document.capabilityInvocation.map(m => ({
					arrayKey: "capabilityInvocation",
					method: Is.string(m) ? { id: m } : m
				}))
			);
		}
		if (Is.arrayValue(document.capabilityDelegation)) {
			methods.push(
				...document.capabilityDelegation.map(m => ({
					arrayKey: "capabilityDelegation",
					method: Is.string(m) ? { id: m } : m
				}))
			);
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
							MemoryIdentityProvider.REVOCATION_BITS_SIZE
						);

						return bitString.getBit(revocationIndex);
					}
				}
			}
		}
		return false;
	}
}

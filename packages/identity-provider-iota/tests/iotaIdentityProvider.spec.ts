// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { Converter, Is } from "@gtsc/core";
import { Bip39, Bip44, KeyType } from "@gtsc/crypto";
import type { IDidDocumentVerificationMethod, IDidService } from "@gtsc/identity-provider-models";
import { TEST_CLIENT_OPTIONS, TEST_WALLET_KEY_PAIR, initTestWallet } from "./testWallet";
import { IotaIdentityProvider } from "../src/iotaIdentityProvider";
import type { IIotaIdentityProviderConfig } from "../src/models/IIotaIdentityProviderConfig";

const TEST_IDENTITY_ACCOUNT_INDEX = 500000;
let testDocumentId: string;
let testDocumentAssertionId: string;
let holderDocumentId: string;
let holderDocumentAssertionId: string;
let testVerificationMethodId: string;
let testServiceId: string;
let testVcJwt: string;
let testVpJwt: string;

/**
 * Test degree type.
 */
interface IDegree {
	/**
	 * The id.
	 */
	id: string;
	/**
	 * The name
	 */
	name: string;
	/**
	 * The degree name.
	 */
	degreeName: string;
}

describe("IotaIdentityProvider", () => {
	beforeAll(async () => {
		await initTestWallet();
	});

	test("can fail to construct with no config", () => {
		expect(
			() => new IotaIdentityProvider(undefined as unknown as IIotaIdentityProviderConfig)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "config",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config.clientOptions", () => {
		expect(() => new IotaIdentityProvider({} as IIotaIdentityProviderConfig)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "config.clientOptions",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to create a document with no document private key ", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument(
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no public key ", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument(new Uint8Array(), undefined as unknown as Uint8Array)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPublicKey",
				value: "undefined"
			}
		});
	});

	test("can create a document", async () => {
		const identityProvider = new IotaIdentityProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			accountIndex: TEST_IDENTITY_ACCOUNT_INDEX
		});

		const testDocument = await identityProvider.createDocument(
			TEST_WALLET_KEY_PAIR.privateKey,
			TEST_WALLET_KEY_PAIR.publicKey
		);
		testDocumentId = testDocument.id;
		expect(testDocument.id.slice(0, 15)).toBe(`did:iota:${process.env.TEST_BECH32_HRP}:0x`);
		console.log("DID Document", `${process.env.TEST_EXPLORER_SEARCH}${testDocument.id.slice(15)}`);
		expect(testDocument.assertionMethod).toBeDefined();
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toBe(`${testDocument.id}#revocation`);

		const assertionMethod = (
			testDocument.assertionMethod as IDidDocumentVerificationMethod[]
		)?.find(v => v.publicKeyJwk?.x === Converter.bytesToBase64Url(TEST_WALLET_KEY_PAIR.publicKey));
		expect(assertionMethod).toBeDefined();
		expect(assertionMethod?.id).toBe(`${testDocument.id}#${assertionMethod?.publicKeyJwk?.kid}`);
		testDocumentAssertionId = assertionMethod?.id ?? "";
	});

	test("can fail to resolve a document with no id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.resolveDocument(undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can resolve a document id", async () => {
		const identityProvider = new IotaIdentityProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			accountIndex: TEST_IDENTITY_ACCOUNT_INDEX
		});

		const doc = await identityProvider.resolveDocument(testDocumentId);
		expect(doc.id.slice(0, 15)).toBe(`did:iota:${process.env.TEST_BECH32_HRP}:0x`);
		expect(doc.assertionMethod).toBeDefined();
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no verification public key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				"foo",
				new Uint8Array(),
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "verificationPublicKey",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		const seed = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC ?? "");
		const verificationKeyPair = Bip44.addressBech32(
			seed,
			KeyType.Ed25519,
			process.env.TEST_BECH32_HRP ?? "",
			Number.parseInt(process.env.TEST_COIN_TYPE ?? "0", 10),
			1000,
			false,
			0
		);
		const doc = await identityProvider.addVerificationMethod(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			verificationKeyPair.keyPair.publicKey
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.verificationMethod).toBeDefined();

		const verificationMethod = (doc.verificationMethod as IDidDocumentVerificationMethod[])?.find(
			v => v.publicKeyJwk?.x === Converter.bytesToBase64Url(verificationKeyPair.keyPair.publicKey)
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toBe(`${doc.id}#${verificationMethod?.publicKeyJwk?.kid}`);

		testVerificationMethodId = verificationMethod?.id ?? "";
	});

	test("can fail to remove a verification method with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a verification method with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				"foo",
				new Uint8Array(),
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can remove a verification method", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.removeVerificationMethod(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			testVerificationMethodId
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.verificationMethod).toBeUndefined();
	});

	test("can fail to add a service with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addService(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addService(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addService(
				"foo",
				new Uint8Array(),
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service type", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addService(
				"foo",
				new Uint8Array(),
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceType",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service endpoint", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addService(
				"foo",
				new Uint8Array(),
				"foo",
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceEndpoint",
				value: "undefined"
			}
		});
	});

	test("can add a service", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.addService(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			`${testDocumentId}#linked-domain`,
			"LinkedDomains",
			"https://bar.example.com/"
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.service).toBeDefined();

		const service = (doc.service as IDidService[])?.find(
			s => s.id === `${testDocumentId}#linked-domain`
		);
		expect(service).toBeDefined();
		expect(service?.type).toBe("LinkedDomains");
		expect(service?.serviceEndpoint).toBe("https://bar.example.com/");

		testServiceId = service?.id ?? "";
	});

	test("can fail to remove a service with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeService(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a service with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeService(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a service with no service id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeService("foo", new Uint8Array(), undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can remove a service", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.removeService(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			testServiceId
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.service).toBeDefined();

		const service = (doc.service as IDidService[])?.find(
			s => s.id === `${testDocumentId}#linked-domain`
		);
		expect(service).toBeUndefined();
	});

	test("can fail to create a verifiable credential with no issuer document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no assertion method id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "assertionMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no assertion method private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "assertionMethodPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no credential id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				new Uint8Array(),
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "credentialId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no schema types", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				new Uint8Array(),
				"foo",
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "schemaTypes",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no subject", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				new Uint8Array(),
				"foo",
				"UniversityDegreeCredential",
				undefined as unknown as IDegree,
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "subject",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no revocation index", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				new Uint8Array(),
				"foo",
				"UniversityDegreeCredential",
				{
					id: "foo",
					name: "Alice",
					degreeName: "Bachelor of Science and Arts"
				},
				undefined as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.number",
			properties: {
				property: "revocationIndex",
				value: "undefined"
			}
		});
	});

	test("can create a verifiable credential", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const holderDoc = await identityProvider.createDocument(
			TEST_WALLET_KEY_PAIR.privateKey,
			TEST_WALLET_KEY_PAIR.publicKey
		);
		holderDocumentId = holderDoc.id;

		const assertionMethod = (holderDoc.assertionMethod as IDidDocumentVerificationMethod[])?.find(
			v => v.publicKeyJwk?.x === Converter.bytesToBase64Url(TEST_WALLET_KEY_PAIR.publicKey)
		);
		holderDocumentAssertionId = assertionMethod?.id ?? "";

		const result = await identityProvider.createVerifiableCredential(
			testDocumentId,
			testDocumentAssertionId,
			TEST_WALLET_KEY_PAIR.privateKey,
			"https://example.edu/credentials/3732",
			"UniversityDegreeCredential",
			{
				id: holderDoc.id,
				name: "Alice",
				degreeName: "Bachelor of Science and Arts"
			},
			5
		);

		expect(result.verifiableCredential["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;

		expect(subject?.id.startsWith("did:iota")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential.issuer.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential.issuanceDate).toBeDefined();
		expect(result.verifiableCredential.credentialStatus?.id?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential.credentialStatus?.type).toEqual("RevocationBitmap2022");
		expect(result.verifiableCredential.credentialStatus?.revocationBitmapIndex).toEqual("5");
		expect(result.jwt.split(".").length).toEqual(3);
		testVcJwt = result.jwt;
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(identityProvider.checkVerifiableCredential<IDegree>("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const result = await identityProvider.checkVerifiableCredential<IDegree>(testVcJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiableCredential?.["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential?.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential?.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;
		expect(subject?.id.startsWith("did:iota")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential?.issuer.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential?.issuanceDate).toBeDefined();
		expect(result.verifiableCredential?.credentialStatus?.id?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential?.credentialStatus?.type).toEqual("RevocationBitmap2022");
		expect(result.verifiableCredential?.credentialStatus?.revocationBitmapIndex).toEqual("5");
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.revokeVerifiableCredentials(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to revoke a verifiable credential with no documentPrivateKey", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.revokeVerifiableCredentials(
				testDocumentId,
				undefined as unknown as Uint8Array,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "issuerDocumentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to revoke a verifiable credential with no credentialIndices", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.revokeVerifiableCredentials(
				testDocumentId,
				new Uint8Array(),
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can revoke a verifiable credential", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.revokeVerifiableCredentials(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			[5]
		);

		expect(doc.service).toBeDefined();
		const revokeService = doc.service?.find(s => s.id === `${testDocumentId}#revocation`);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,eJyzMmBgYGSAAAEgZmUAAAfOAIE"
		);

		const result = await identityProvider.checkVerifiableCredential<IDegree>(testVcJwt);
		expect(result.revoked).toBeTruthy();
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.unrevokeVerifiableCredentials(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to unrevoke a verifiable credential with no documentPrivateKey", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.unrevokeVerifiableCredentials(
				testDocumentId,
				undefined as unknown as Uint8Array,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "issuerDocumentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to unrevoke a verifiable credential with no credentialIndices", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.unrevokeVerifiableCredentials(
				testDocumentId,
				new Uint8Array(),
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can unrevoke a verifiable credential", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.unrevokeVerifiableCredentials(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			[5]
		);

		expect(doc.service).toBeDefined();
		const revokeService = doc.service?.find(s => s.id === `${testDocumentId}#revocation`);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,eJyzMmAAAwADKABr"
		);

		const result = await identityProvider.checkVerifiableCredential<IDegree>(testVcJwt);
		expect(result.revoked).toBeFalsy();
	});

	test("can fail to create a verifiable presentation with no holder document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiablePresentation(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "holderDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no assertion method id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiablePresentation(
				"foo",
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "presentationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no assertion method private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiablePresentation(
				"foo",
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "presentationPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no types", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiablePresentation(
				"foo",
				"foo",
				new Uint8Array(),
				undefined as unknown as string[],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "schemaTypes",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createVerifiablePresentation(
				"foo",
				"foo",
				new Uint8Array(),
				["vp"],
				undefined as unknown as string[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "verifiableCredentials",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable presentation with invalid expiry", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(
			identityProvider.createVerifiablePresentation(
				"foo",
				"foo",
				new Uint8Array(),
				["vp"],
				["jwt"],
				"foo" as unknown as number
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.integer",
			properties: {
				property: "expiresInMinutes",
				value: "foo"
			}
		});
	});

	test("can create a verifiable presentation", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const result = await identityProvider.createVerifiablePresentation(
			holderDocumentId,
			holderDocumentAssertionId,
			TEST_WALLET_KEY_PAIR.privateKey,
			["ExamplePresentation"],
			[testVcJwt],
			14400
		);

		expect(result.verifiablePresentation["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiablePresentation.type).toEqual([
			"VerifiablePresentation",
			"ExamplePresentation"
		]);
		expect(result.verifiablePresentation.verifiableCredential).toBeDefined();
		expect(result.verifiablePresentation.verifiableCredential[0]).toEqual(testVcJwt);
		expect(result.verifiablePresentation.holder?.startsWith("did:iota")).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
		testVpJwt = result.jwt;
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		await expect(identityProvider.checkVerifiablePresentation("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentationJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const result = await identityProvider.checkVerifiablePresentation(testVpJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiablePresentation?.["@context"]).toEqual(
			"https://www.w3.org/2018/credentials/v1"
		);
		expect(result.verifiablePresentation?.type).toEqual([
			"VerifiablePresentation",
			"ExamplePresentation"
		]);
		expect(result.verifiablePresentation?.verifiableCredential).toBeDefined();
		expect(result.verifiablePresentation?.holder?.startsWith("did:iota")).toBeTruthy();
		expect(result.issuers).toBeDefined();
		expect(result.issuers?.length).toEqual(1);
		expect(result.issuers?.[0].id).toEqual(testDocumentId);
	});

	test("can fail to create a proof with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createProof(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no verificationMethodId", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createProof(
				"foo",
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no verificationPrivateKey", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createProof(
				"foo",
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "verificationPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no bytes", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createProof(
				"foo",
				"foo",
				new Uint8Array(),
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "bytes",
				value: "undefined"
			}
		});
	});

	test("can create a proof", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		const proof = await identityProvider.createProof(
			testDocumentId,
			testDocumentAssertionId,
			TEST_WALLET_KEY_PAIR.privateKey,
			new Uint8Array([0, 1, 2, 3, 4])
		);
		expect(proof.type).toEqual("Ed25519");
		expect(Converter.bytesToHex(proof.value)).toEqual(
			"f39c8ec4967723c256b0ca09339404897a426172a5c7182e31b6a57228ea34d969529624a38324f6ee4e103b05f5c65dc72f208f47b28f7a88a4fb49fa55a00a"
		);
	});

	test("can fail to verify a proof with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.verifyProof(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no verificationMethodId", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.verifyProof(
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no signatureType", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.verifyProof(
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "signatureType",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no signatureValue", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.verifyProof(
				"foo",
				"foo",
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "signatureValue",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no bytes", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.verifyProof(
				"foo",
				"foo",
				"foo",
				new Uint8Array(),
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "bytes",
				value: "undefined"
			}
		});
	});

	test("can verify a proof", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		const verified = await identityProvider.verifyProof(
			testDocumentId,
			testDocumentAssertionId,
			"Ed25519",
			Converter.hexToBytes(
				"f39c8ec4967723c256b0ca09339404897a426172a5c7182e31b6a57228ea34d969529624a38324f6ee4e103b05f5c65dc72f208f47b28f7a88a4fb49fa55a00a"
			),
			new Uint8Array([0, 1, 2, 3, 4])
		);
		expect(verified).toBeTruthy();
	});
});

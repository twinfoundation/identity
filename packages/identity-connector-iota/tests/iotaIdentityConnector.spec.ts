// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, Is } from "@gtsc/core";
import type { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import type {
	DidVerificationMethodType,
	IDidDocumentVerificationMethod,
	IDidService
} from "@gtsc/standards-w3c-did";
import type { VaultSecret } from "@gtsc/vault-connector-entity-storage";
import {
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY_ID,
	TEST_MNEMONIC_NAME,
	setupTestEnv
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import { IotaIdentityUtils } from "../src/iotaIdentityUtils";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig";

const TEST_REVOCATION_INDEX = 15;
let testDocumentId: string;
let testDocumentVerificationMethodId: string;
let testServiceId: string;
let holderDocumentVerificationMethodId: string;
let testVcJwt: string;
let testVpJwt: string;
let testProofSignature: Uint8Array;

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

describe("IotaIdentityConnector", () => {
	beforeAll(async () => {
		await setupTestEnv();
	});

	test("can fail to construct with no options", () => {
		expect(
			() =>
				new IotaIdentityConnector(undefined as unknown as { config: IIotaIdentityConnectorConfig })
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config", () => {
		expect(
			() => new IotaIdentityConnector({} as unknown as { config: IIotaIdentityConnectorConfig })
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options.config",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config.clientOptions", () => {
		expect(
			() =>
				new IotaIdentityConnector({ config: {} } as unknown as {
					config: IIotaIdentityConnectorConfig;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options.config.clientOptions",
					value: "undefined"
				}
			})
		);
	});

	test("can create a document", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		testDocumentId = testDocument.id;

		expect(testDocument.id.slice(0, 15)).toEqual(`did:iota:${process.env.TEST_BECH32_HRP}:0x`);
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toEqual(`${testDocument.id}#revocation`);

		console.debug(
			"DID Document",
			`${process.env.TEST_EXPLORER_URL}addr/${IotaIdentityUtils.didToAddress(testDocument.id)}?tab=DID`
		);
	});

	test("can fail to resolve a document with no id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.resolveDocument(undefined as unknown as string)
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const doc = await identityConnector.resolveDocument(testDocumentId);
		expect(doc.id.slice(0, 15)).toEqual(`did:iota:${process.env.TEST_BECH32_HRP}:0x`);
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toEqual(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addVerificationMethod(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as DidVerificationMethodType,
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

	test("can fail to add a verification method with no document verification method type", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addVerificationMethod(
				TEST_IDENTITY_ID,
				"foo",
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.arrayOneOf",
			properties: {
				property: "verificationMethodType",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId,
			"assertionMethod",
			"my-verification-id"
		);

		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toEqual(`${testDocumentId}#my-verification-id`);

		testDocumentVerificationMethodId = verificationMethod?.id ?? "";
		const keyStore =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultSecret>>(
				"vault-key"
			).getStore();
		expect(keyStore?.[0].id).toEqual(`${TEST_IDENTITY_ID}/${testDocumentId}#my-verification-id`);
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.removeVerificationMethod(TEST_IDENTITY_ID, undefined as unknown as string)
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const vm = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId,
			"authentication",
			"test-method"
		);

		let doc = await identityConnector.resolveDocument(testDocumentId);
		expect(doc.authentication).toBeDefined();
		expect(doc.authentication?.length).toEqual(1);
		expect(
			(doc.authentication?.[0] as IDidDocumentVerificationMethod).id.endsWith("test-method")
		).toEqual(true);

		await identityConnector.removeVerificationMethod(TEST_IDENTITY_ID, vm.id);

		doc = await identityConnector.resolveDocument(testDocumentId);
		expect(doc.authentication).toBeUndefined();
	});

	test("can fail to add a service with no document id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
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

	test("can fail to add a service with no service id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const service = await identityConnector.addService(
			TEST_IDENTITY_ID,
			testDocumentId,
			"linked-domain",
			"LinkedDomains",
			"https://bar.example.com/"
		);

		expect(service).toBeDefined();
		expect(service?.type).toEqual("LinkedDomains");
		expect(service?.serviceEndpoint).toEqual("https://bar.example.com/");

		testServiceId = service?.id ?? "";
	});

	test("can fail to remove a service with no service id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.removeService(TEST_IDENTITY_ID, undefined as unknown as string)
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await identityConnector.removeService(TEST_IDENTITY_ID, testServiceId);
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as string,
				undefined as unknown as number
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

	test("can fail to create a verifiable credential with no subject", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				TEST_IDENTITY_ID,
				"foo",
				"foo",
				"UniversityDegreeCredential",
				undefined as unknown as IDegree,
				undefined as unknown as string,
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

	test("can create a verifiable credential", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const holderDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		const holderVm = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			holderDocument.id,
			"assertionMethod",
			"my-presentation-id"
		);
		holderDocumentVerificationMethodId = holderVm.id;

		const result = await identityConnector.createVerifiableCredential(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId,
			"https://example.edu/credentials/3732",
			"UniversityDegreeCredential",
			{
				id: holderDocument.id,
				name: "Alice",
				degreeName: "Bachelor of Science and Arts"
			},
			["https://example.com/my-schema"],
			TEST_REVOCATION_INDEX
		);

		expect(result.verifiableCredential["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;

		expect(subject?.id.startsWith("did:iota")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential.issuer?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential.issuanceDate).toBeDefined();
		expect(result.verifiableCredential.credentialStatus?.id?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential.credentialStatus?.type).toEqual("RevocationBitmap2022");
		expect(result.verifiableCredential.credentialStatus?.revocationBitmapIndex).toEqual(
			TEST_REVOCATION_INDEX.toString()
		);
		expect(result.jwt.split(".").length).toEqual(3);
		testVcJwt = result.jwt;
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(identityConnector.checkVerifiableCredential<IDegree>("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const result = await identityConnector.checkVerifiableCredential<IDegree>(testVcJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiableCredential?.["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
		expect(result.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential?.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential?.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;
		expect(subject?.id.startsWith("did:iota")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential?.issuer?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential?.issuanceDate).toBeDefined();
		expect(result.verifiableCredential?.credentialStatus?.id?.startsWith("did:iota")).toBeTruthy();
		expect(result.verifiableCredential?.credentialStatus?.type).toEqual("RevocationBitmap2022");
		expect(result.verifiableCredential?.credentialStatus?.revocationBitmapIndex).toEqual(
			TEST_REVOCATION_INDEX.toString()
		);
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
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

	test("can fail to revoke a verifiable credential with no credentialIndices", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				testDocumentId,
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await identityConnector.revokeVerifiableCredentials(TEST_IDENTITY_ID, testDocumentId, [
			TEST_REVOCATION_INDEX
		]);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(testVcJwt);
		expect(result.revoked).toBeTruthy();
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
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

	test("can fail to unrevoke a verifiable credential with no credentialIndices", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				testDocumentId,
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await identityConnector.unrevokeVerifiableCredentials(TEST_IDENTITY_ID, testDocumentId, [
			TEST_REVOCATION_INDEX
		]);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(testVcJwt);
		expect(result.revoked).toBeFalsy();
	});

	test("can fail to create a verifiable presentation with no presentation method id", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined as unknown as number
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

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				"foo",
				["vp"],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined as unknown as number
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				"foo",
				["vp"],
				["jwt"],
				undefined as unknown as string[],
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const result = await identityConnector.createVerifiablePresentation(
			TEST_IDENTITY_ID,
			holderDocumentVerificationMethodId,
			["ExamplePresentation"],
			[testVcJwt],
			["https://example.com/my-schema"],
			14400
		);

		expect(result.verifiablePresentation["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		await expect(identityConnector.checkVerifiablePresentation("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentationJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});

		const result = await identityConnector.checkVerifiablePresentation(testVpJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiablePresentation?.["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
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

	test("can fail to create a proof with no verificationMethodId", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.createProof(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
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

	test("can fail to create a proof with no bytes", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.createProof(TEST_IDENTITY_ID, "foo", undefined as unknown as Uint8Array)
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId,
			new Uint8Array([0, 1, 2, 3, 4])
		);
		expect(proof.type).toEqual("Ed25519");
		expect(proof.value).toBeDefined();

		testProofSignature = proof.value;
	});

	test("can fail to verify a proof with no verificationMethodId", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.verifyProof(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
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

	test("can fail to verify a proof with no bytes", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.verifyProof(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
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

	test("can fail to verify a proof with no signatureType", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.verifyProof(
				"foo",
				Converter.utf8ToBytes("foo"),
				undefined as unknown as string,
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
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		await expect(
			identityConnector.verifyProof(
				"foo",
				Converter.utf8ToBytes("foo"),
				"foo",
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

	test("can verify a proof", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME
			}
		});
		const verified = await identityConnector.verifyProof(
			testDocumentVerificationMethodId,
			new Uint8Array([0, 1, 2, 3, 4]),
			"Ed25519",
			testProofSignature
		);
		expect(verified).toBeTruthy();
	});
});

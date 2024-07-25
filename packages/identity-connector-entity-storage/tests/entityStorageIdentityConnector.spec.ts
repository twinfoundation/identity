// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, Is } from "@gtsc/core";
import { Ed25519 } from "@gtsc/crypto";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import { nameof } from "@gtsc/nameof";
import type { IServiceRequestContext } from "@gtsc/services";
import type { DidVerificationMethodType, IDidDocument, IDidService } from "@gtsc/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector";
import { initSchema as initSchemaIdentity } from "../src/schema";

let testIdentityDocument: IdentityDocument;
let testDocumentKey: VaultKey;
let testDocumentVerificationMethodKey: VaultKey;
let testDocumentVerificationMethodId: string;
let testServiceId: string;
let testProof: Uint8Array;
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

let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;

export const TEST_PARTITION_ID = "test-partition";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";
export const TEST_CONTROLLER = "test-controller";

export const TEST_CONTEXT: IServiceRequestContext = {
	partitionId: TEST_PARTITION_ID,
	identity: TEST_IDENTITY_ID
};

describe("EntityStorageIdentityConnector", () => {
	beforeEach(() => {
		initSchemaVault();
		initSchemaIdentity();

		didDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>()
		});

		vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>()
		});

		const vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>()
		});

		EntityStorageConnectorFactory.register("identity-document", () => didDocumentEntityStorage);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorageConnector);

		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());
	});

	test("can create a document", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		const testDocument = await identityConnector.createDocument(TEST_CONTROLLER, TEST_CONTEXT);

		const keyStore = vaultKeyEntityStorageConnector.getStore(TEST_PARTITION_ID);
		testDocumentKey = keyStore?.[0] ?? ({} as VaultKey);

		expect(testDocument.id.slice(0, 21)).toEqual("did:entity-storage:0x");
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toEqual(`${testDocument.id}#revocation`);

		const revocationService = testDocument.service?.[0];
		expect(revocationService).toBeDefined();
		expect(revocationService?.id).toEqual(`${testDocument.id}#revocation`);
		expect(revocationService?.type).toEqual("BitstringStatusList");
		expect(revocationService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
		);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_PARTITION_ID
		)?.[0] as IdentityDocument;

		TEST_CONTEXT.identity = testIdentityDocument.id;
	});

	test("can fail to resolve a document with no id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();

		const doc = await identityConnector.resolveDocument(testIdentityDocument.id, TEST_CONTEXT);
		expect(doc.id.slice(0, 21)).toEqual("did:entity-storage:0x");
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toEqual(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addVerificationMethod(
				undefined as unknown as string,
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string,
				TEST_CONTEXT
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

	test("can fail to add a verification method with incorrect verification method type", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addVerificationMethod(
				"aaa",
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string,
				TEST_CONTEXT
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

	test("can add a verification method as assertion method", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();
		const verificationMethod = await identityConnector.addVerificationMethod(
			testIdentityDocument.id,
			"assertionMethod",
			"my-verification-id",
			TEST_CONTEXT
		);

		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toEqual(`${testIdentityDocument.id}#my-verification-id`);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_PARTITION_ID
		)?.[0] as IdentityDocument;

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;
		expect(testDocument?.assertionMethod).toBeDefined();

		testDocumentVerificationMethodId = verificationMethod?.id ?? "";

		const keyStore = vaultKeyEntityStorageConnector.getStore(TEST_PARTITION_ID);
		testDocumentVerificationMethodKey = keyStore?.[1] ?? ({} as VaultKey);
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.removeVerificationMethod(undefined as unknown as string)
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.removeVerificationMethod(
			testDocumentVerificationMethodId,
			TEST_CONTEXT
		);

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;
		expect(testDocument?.verificationMethod).toBeUndefined();
	});

	test("can fail to add a service with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addService(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addService(
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addService(
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addService(
				"foo",
				"foo",
				"foo",
				undefined as unknown as string,
				TEST_CONTEXT
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();

		const service = await identityConnector.addService(
			testIdentityDocument.id,
			"linked-domain",
			"LinkedDomains",
			"https://bar.example.com/",
			TEST_CONTEXT
		);

		expect(service).toBeDefined();
		expect(service?.type).toEqual("LinkedDomains");
		expect(service?.serviceEndpoint).toEqual("https://bar.example.com/");

		testServiceId = service?.id ?? "";
	});

	test("can fail to remove a service with no service id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.removeService(undefined as unknown as string)
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.removeService(testServiceId, TEST_CONTEXT);

		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		expect(testDocument?.service).toBeDefined();

		const service = (testDocument?.service as IDidService[])?.find(
			s => s.id === `${testDocument.id}#linked-domain`
		);
		expect(service).toBeUndefined();
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IDegree,
				undefined as unknown as string,
				undefined as unknown as number,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createVerifiableCredential<IDegree>(
				"foo",
				"foo",
				"UniversityDegreeCredential",
				undefined as unknown as IDegree,
				undefined as unknown as string,
				undefined as unknown as number,
				TEST_CONTEXT
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
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey, TEST_CONTEXT);
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		const holderDocument = await identityConnector.createDocument(TEST_CONTROLLER, TEST_CONTEXT);

		const result = await identityConnector.createVerifiableCredential(
			testDocumentVerificationMethodId,
			"https://example.edu/credentials/3732",
			"UniversityDegreeCredential",
			{
				id: holderDocument.id,
				name: "Alice",
				degreeName: "Bachelor of Science and Arts"
			},
			["https://example.com/my-schema"],
			5,
			TEST_CONTEXT
		);

		expect(result.verifiableCredential["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential.type).toContain("UniversityDegreeCredential");

		const subject = Is.array(result.verifiableCredential.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential.credentialSubject;
		expect(subject.id.startsWith("did:entity-storage")).toBeTruthy();
		expect(subject.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject.name).toEqual("Alice");
		expect(result.verifiableCredential.issuer?.startsWith("did:entity-storage")).toBeTruthy();
		expect(result.verifiableCredential.issuanceDate).toBeDefined();
		expect(
			result.verifiableCredential.credentialStatus?.id?.startsWith("did:entity-storage")
		).toBeTruthy();
		expect(result.verifiableCredential.credentialStatus?.type).toEqual("BitstringStatusList");
		expect(result.verifiableCredential.credentialStatus?.revocationBitmapIndex).toEqual("5");
		expect(result.jwt.split(".").length).toEqual(3);

		testVcJwt = result.jwt;
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		const identityConnector = new EntityStorageIdentityConnector();

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			testVcJwt,
			TEST_CONTEXT
		);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiableCredential?.["@context"]).toEqual([
			"https://www.w3.org/2018/credentials/v1",
			"https://example.com/my-schema"
		]);
		expect(result.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential?.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential?.type).toContain("UniversityDegreeCredential");
		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential?.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;
		expect(subject?.id.startsWith("did:entity-storage")).toBeTruthy();
		expect(subject?.degreeName).toEqual("Bachelor of Science and Arts");
		expect(subject?.name).toEqual("Alice");
		expect(result.verifiableCredential?.issuer?.startsWith("did:entity-storage")).toBeTruthy();
		expect(result.verifiableCredential?.issuanceDate).toBeDefined();
		expect(
			result.verifiableCredential?.credentialStatus?.id?.startsWith("did:entity-storage")
		).toBeTruthy();
		expect(result.verifiableCredential?.credentialStatus?.type).toEqual("BitstringStatusList");
		expect(result.verifiableCredential?.credentialStatus?.revocationBitmapIndex).toEqual("5");
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.revokeVerifiableCredentials(
				undefined as unknown as string,
				undefined as unknown as number[],
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.revokeVerifiableCredentials(
				testIdentityDocument.id,
				undefined as unknown as number[],
				TEST_CONTEXT
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.revokeVerifiableCredentials(testIdentityDocument.id, [5], TEST_CONTEXT);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_PARTITION_ID
		)?.[0] as IdentityDocument;
		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		expect(testDocument.service).toBeDefined();
		const revokeService = testDocument.service?.find(
			s => s.id === `${testIdentityDocument.id}#revocation`
		);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BIQEAAAACIKf4f6UzLEADAAAAAAAAAAAAAAAAAAAAvA1-s-l1AEAAAA"
		);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			testVcJwt,
			TEST_CONTEXT
		);
		expect(result.revoked).toBeTruthy();
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				undefined as unknown as string,
				undefined as unknown as number[],
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				testIdentityDocument.id,
				undefined as unknown as number[],
				TEST_CONTEXT
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
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.unrevokeVerifiableCredentials(
			testIdentityDocument.id,
			[5],
			TEST_CONTEXT
		);

		testIdentityDocument = didDocumentEntityStorage.getStore(
			TEST_PARTITION_ID
		)?.[0] as IdentityDocument;
		const testDocument = JSON.parse(testIdentityDocument.document) as IDidDocument;

		const revokeService = testDocument.service?.find(s => s.id === `${testDocument.id}#revocation`);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
		);

		const result = await identityConnector.checkVerifiableCredential<IDegree>(
			testVcJwt,
			TEST_CONTEXT
		);
		expect(result.revoked).toBeFalsy();
	});

	test("can fail to create a verifiable presentation with no presentation method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.createVerifiablePresentation(
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createVerifiablePresentation(
				"foo",
				["vp"],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.createVerifiablePresentation(
				"foo",
				["vp"],
				["jwt"],
				undefined as unknown as string[],
				"foo" as unknown as number,
				TEST_CONTEXT
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
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey, TEST_CONTEXT);
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		const result = await identityConnector.createVerifiablePresentation(
			testDocumentVerificationMethodId,
			["ExamplePresentation"],
			[testVcJwt],
			["https://example.com/my-schema"],
			14400,
			TEST_CONTEXT
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
		expect(result.verifiablePresentation.holder?.startsWith("did:entity-storage")).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
		testVpJwt = result.jwt;
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.checkVerifiablePresentation("", TEST_CONTEXT)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentationJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();
		const result = await identityConnector.checkVerifiablePresentation(testVpJwt, TEST_CONTEXT);

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
		expect(result.verifiablePresentation?.holder?.startsWith("did:entity-storage")).toBeTruthy();
		expect(result.issuers).toBeDefined();
		expect(result.issuers?.length).toEqual(1);
		expect(result.issuers?.[0].id).toEqual(testIdentityDocument.id);
	});

	test("can fail to create a proof with no verificationMethodId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createProof(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createProof("foo", undefined as unknown as Uint8Array, TEST_CONTEXT)
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
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey, TEST_CONTEXT);
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		const bytes = new Uint8Array([0, 1, 2, 3, 4]);
		const proof = await identityConnector.createProof(
			testDocumentVerificationMethodId,
			bytes,
			TEST_CONTEXT
		);
		expect(proof.type).toEqual("Ed25519");

		testProof = proof.value;

		const sig = Ed25519.sign(
			Converter.base64UrlToBytes(testDocumentVerificationMethodKey.privateKey),
			bytes
		);
		expect(proof.value).toEqual(sig);
	});

	test("can fail to verify a proof with no verificationMethodId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				"foo",
				Converter.utf8ToBytes("foo"),
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				TEST_CONTEXT
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
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				"foo",
				Converter.utf8ToBytes("foo"),
				"foo",
				undefined as unknown as Uint8Array,
				TEST_CONTEXT
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

	test("can fail to verify a proof with missing document", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				"foo#123",
				Converter.utf8ToBytes("foo"),
				"foo",
				Converter.utf8ToBytes("foo"),
				TEST_CONTEXT
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			inner: {
				name: "NotFoundError",
				source: "EntityStorageIdentityConnector",
				message: "entityStorageIdentityConnector.documentNotFound",
				properties: { notFoundId: "foo" }
			}
		});
	});

	test("can verify a proof", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentKey, TEST_CONTEXT);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey, TEST_CONTEXT);

		const identityConnector = new EntityStorageIdentityConnector();

		const verified = await identityConnector.verifyProof(
			testDocumentVerificationMethodId,
			new Uint8Array([0, 1, 2, 3, 4]),
			"Ed25519",
			testProof,
			TEST_CONTEXT
		);
		expect(verified).toBeTruthy();
	});

	test("can create a full document with keys and verification methods", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		const requestContext: IServiceRequestContext = {
			partitionId: "test"
		};

		const doc = await identityConnector.createDocument(
			"tst1pqvhcdyt3lmz752u495977jt2eaqwwswd3yjceqlm5pfmyy3ymdfx6c48gj",
			requestContext
		);

		requestContext.identity = doc.id;
		await identityConnector.addVerificationMethod(
			doc.id,
			"assertionMethod",
			"attestation",
			requestContext
		);

		const keyStore = vaultKeyEntityStorageConnector.getStore("test");
		console.log("key", JSON.stringify(keyStore?.[0], undefined, "\t"));

		const docStore = didDocumentEntityStorage.getStore("test");
		expect(docStore?.[0].id).toEqual(doc.id);
		console.log("doc", JSON.stringify(docStore?.[0], undefined, "\t"));
	});
});

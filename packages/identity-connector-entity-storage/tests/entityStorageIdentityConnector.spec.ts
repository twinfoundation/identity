// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is, ObjectHelper, RandomHelper } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { nameof } from "@twin.org/nameof";
import {
	DidContexts,
	DidTypes,
	type DidVerificationMethodType,
	type IDidCredentialStatus,
	type IDidService,
	type IDidVerifiableCredential,
	type IProof,
	ProofTypes
} from "@twin.org/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector";
import { EntityStorageIdentityResolverConnector } from "../src/entityStorageIdentityResolverConnector";
import { initSchema as initSchemaIdentity } from "../src/schema";

let testIdentityDocument: IdentityDocument;
let testDocumentKey: VaultKey;
let testDocumentVerificationMethodKey: VaultKey;
let testDocumentVerificationMethodId: string;
let testServiceId: string;
let testVcJwt: string;
let testVpJwt: string;

let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;

export const TEST_IDENTITY_ID = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";
export const TEST_CONTROLLER = "test-controller";

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

		Date.now = vi.fn(() => new Date("2024-01-31T16:00:45.490Z").getTime());

		let randomCounter = 1;
		RandomHelper.generate = vi
			.fn()
			.mockImplementation(length => new Uint8Array(length).fill(randomCounter++));

		Bip39.randomMnemonic = vi
			.fn()
			.mockImplementation(
				() =>
					"elder blur tip exact organ pipe other same minute grace conduct father brother prosper tide icon pony suggest joy provide dignity domain nominee liquid"
			);
	});

	test("can create a document", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const keyStore = vaultKeyEntityStorageConnector.getStore();
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

		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to resolve a document with no id", async () => {
		const identityResolverConnector = new EntityStorageIdentityResolverConnector();
		await expect(
			identityResolverConnector.resolveDocument(undefined as unknown as string)
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityResolverConnector = new EntityStorageIdentityResolverConnector();

		const doc = await identityResolverConnector.resolveDocument(testIdentityDocument.id);
		expect(doc.id.slice(0, 21)).toEqual("did:entity-storage:0x");
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toEqual(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
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

	test("can fail to add a verification method with incorrect verification method type", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.addVerificationMethod(
				TEST_IDENTITY_ID,
				"aaa",
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

	test("can add a verification method as assertion method", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector();
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testIdentityDocument.id,
			"assertionMethod",
			"my-verification-id"
		);

		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toEqual(`${testIdentityDocument.id}#my-verification-id`);

		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);

		const testDocument = testIdentityDocument.document;
		expect(testDocument?.assertionMethod).toBeDefined();

		testDocumentVerificationMethodId = verificationMethod?.id ?? "";

		const keyStore = vaultKeyEntityStorageConnector.getStore();
		testDocumentVerificationMethodKey = keyStore?.[1] ?? ({} as VaultKey);
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.removeVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId
		);

		const testDocument = testIdentityDocument.document;
		expect(testDocument?.verificationMethod).toBeUndefined();

		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to add a service with no document id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
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
		const identityConnector = new EntityStorageIdentityConnector();
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
		const identityConnector = new EntityStorageIdentityConnector();
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
		const identityConnector = new EntityStorageIdentityConnector();
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector();

		const service = await identityConnector.addService(
			TEST_IDENTITY_ID,
			testIdentityDocument.id,
			"linked-domain",
			"LinkedDomains",
			"https://bar.example.com/"
		);

		expect(service).toBeDefined();
		expect(service?.type).toEqual("LinkedDomains");
		expect(service?.serviceEndpoint).toEqual("https://bar.example.com/");

		testServiceId = service?.id ?? "";
		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to remove a service with no service id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.removeService(TEST_IDENTITY_ID, testServiceId);

		const testDocument = testIdentityDocument.document;

		expect(testDocument?.service).toBeDefined();

		const service = (testDocument?.service as IDidService[])?.find(
			s => s.id === `${testDocument.id}#linked-domain`
		);
		expect(service).toBeUndefined();
		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.createVerifiableCredential(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as IJsonLdNodeObject,
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

	test("can fail to create a verifiable credential with no credential", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_IDENTITY_ID,
				"foo",
				"UniversityDegreeCredential",
				undefined as unknown as IJsonLdNodeObject,
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
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testIdentityDocument.id,
			"assertionMethod",
			"my-verification-id"
		);

		const holderDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const result = await identityConnector.createVerifiableCredential(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId,
			"https://example.com/credentials/3732",
			{
				"@context": "https://schema.org",
				"@type": "Person",
				id: holderDocument.id,
				name: "Jane Doe"
			},
			5
		);

		expect(result.verifiableCredential["@context"]).toEqual([
			DidContexts.ContextVCv2,
			"https://schema.org"
		]);
		expect(result.verifiableCredential.id).toEqual("https://example.com/credentials/3732");
		expect(result.verifiableCredential.type).toContain(DidTypes.VerifiableCredential);
		expect(result.verifiableCredential.type).toContain("Person");

		const subject = Is.array(result.verifiableCredential.credentialSubject)
			? result.verifiableCredential.credentialSubject[0]
			: result.verifiableCredential.credentialSubject;
		expect((subject?.id as string).startsWith("did:entity-storage")).toBeTruthy();
		expect(subject?.name).toEqual("Jane Doe");
		expect(
			(result.verifiableCredential.issuer as string)?.startsWith("did:entity-storage")
		).toBeTruthy();
		expect(result.verifiableCredential.issuanceDate).toBeDefined();
		expect(
			(result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.id?.startsWith(
				"did:entity-storage"
			)
		).toBeTruthy();
		expect((result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.type).toEqual(
			"BitstringStatusList"
		);
		expect(
			(result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.revocationBitmapIndex
		).toEqual("5");
		expect(result.jwt.split(".").length).toEqual(3);

		testVcJwt = result.jwt;
		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(identityConnector.checkVerifiableCredential("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		const identityConnector = new EntityStorageIdentityConnector();

		const result = await identityConnector.checkVerifiableCredential(testVcJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiableCredential?.["@context"]).toEqual([
			DidContexts.ContextVCv2,
			"https://schema.org"
		]);
		expect(result.verifiableCredential?.id).toEqual("https://example.com/credentials/3732");
		expect(result.verifiableCredential?.type).toContain(DidTypes.VerifiableCredential);
		expect(result.verifiableCredential?.type).toContain("Person");
		const subject = Is.array(result.verifiableCredential?.credentialSubject)
			? result.verifiableCredential?.credentialSubject[0]
			: result.verifiableCredential?.credentialSubject;
		expect((subject?.id as string).startsWith("did:entity-storage")).toBeTruthy();
		expect(subject?.name).toEqual("Jane Doe");
		expect(
			(result.verifiableCredential?.issuer as string)?.startsWith("did:entity-storage")
		).toBeTruthy();
		expect(result.verifiableCredential?.issuanceDate).toBeDefined();
		expect(
			(result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.id?.startsWith(
				"did:entity-storage"
			)
		).toBeTruthy();
		expect((result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.type).toEqual(
			"BitstringStatusList"
		);
		expect(
			(result.verifiableCredential?.credentialStatus as IDidCredentialStatus)?.revocationBitmapIndex
		).toEqual("5");
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

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
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				testIdentityDocument.id,
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.revokeVerifiableCredentials(TEST_IDENTITY_ID, testIdentityDocument.id, [
			5
		]);

		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
		const testDocument = testIdentityDocument.document;

		expect(testDocument.service).toBeDefined();
		const revokeService = testDocument.service?.find(
			s => s.id === `${testIdentityDocument.id}#revocation`
		);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BIQEAAAACIKf4f6UzLEADAAAAAAAAAAAAAAAAAAAAvA1-s-l1AEAAAA"
		);

		const result = await identityConnector.checkVerifiableCredential(testVcJwt);
		expect(result.revoked).toBeTruthy();
		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

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
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				testIdentityDocument.id,
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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector();

		await identityConnector.unrevokeVerifiableCredentials(
			TEST_IDENTITY_ID,
			testIdentityDocument.id,
			[5]
		);

		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
		const testDocument = testIdentityDocument.document;

		const revokeService = testDocument.service?.find(s => s.id === `${testDocument.id}#revocation`);
		expect(revokeService).toBeDefined();
		expect(revokeService?.serviceEndpoint).toEqual(
			"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
		);

		const result = await identityConnector.checkVerifiableCredential(testVcJwt);
		expect(result.revoked).toBeFalsy();
		testIdentityDocument = ObjectHelper.clone(
			didDocumentEntityStorage.getStore()?.[0] as IdentityDocument
		);
	});

	test("can fail to create a verifiable presentation with no presentation method id", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined
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

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				"verificationMethodId",
				undefined as unknown as string,
				["vp"],
				undefined as unknown as string[],
				undefined as unknown as string[],
				undefined
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
				TEST_IDENTITY_ID,
				"foo",
				"presentationId",
				{ "@context": "" },
				["types"],
				["verifiableCredentials"],
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
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector();

		const result = await identityConnector.createVerifiablePresentation(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId,
			"presentationId",
			"https://schema.org",
			["Person"],
			[testVcJwt],
			14400
		);

		expect(result.verifiablePresentation["@context"]).toEqual([
			DidContexts.ContextVCv2,
			"https://schema.org"
		]);
		expect(result.verifiablePresentation.type).toEqual([DidTypes.VerifiablePresentation, "Person"]);
		expect(result.verifiablePresentation.verifiableCredential).toBeDefined();
		expect(
			(result.verifiablePresentation.verifiableCredential as IDidVerifiableCredential[])[0]
		).toEqual(testVcJwt);
		expect(result.verifiablePresentation.holder?.startsWith("did:entity-storage")).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
		testVpJwt = result.jwt;
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		const identityConnector = new EntityStorageIdentityConnector();

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
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);

		const identityConnector = new EntityStorageIdentityConnector();
		const result = await identityConnector.checkVerifiablePresentation(testVpJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiablePresentation?.["@context"]).toEqual([
			DidContexts.ContextVCv2,
			"https://schema.org"
		]);
		expect(result.verifiablePresentation?.type).toEqual([
			DidTypes.VerifiablePresentation,
			"Person"
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
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
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

	test("can fail to create a proof with no document", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.createProof(
				TEST_IDENTITY_ID,
				"foo",
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "unsecureDocument",
				value: "undefined"
			}
		});
	});

	test("can create a proof", async () => {
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey);
		await didDocumentEntityStorage.set(testIdentityDocument);

		const identityConnector = new EntityStorageIdentityConnector();

		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			testDocumentVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			type: "DataIntegrityProof",
			cryptosuite: "eddsa-jcs-2022",
			created: "2024-01-31T16:00:45.490Z",
			verificationMethod:
				"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#my-verification-id",
			proofPurpose: "assertionMethod",
			proofValue:
				"z2zGoejwpX6HH2T11BZaniEVZrqRKDpwbQSvPcL7eL9M7hV5P9zQQZxs85n6qyDzkkXCL8aFUWfwQD5bxVGqDK1fa"
		});
	});

	test("can fail to verify a proof with no document", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof(
				undefined as unknown as IJsonLdNodeObject,
				undefined as unknown as IProof
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "document",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no proof", async () => {
		const identityConnector = new EntityStorageIdentityConnector();
		await expect(
			identityConnector.verifyProof({}, undefined as unknown as IProof)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "proof",
				value: "undefined"
			}
		});
	});

	test("can verify a proof", async () => {
		await didDocumentEntityStorage.set(testIdentityDocument);
		await vaultKeyEntityStorageConnector.set(testDocumentKey);
		await vaultKeyEntityStorageConnector.set(testDocumentVerificationMethodKey);

		const identityConnector = new EntityStorageIdentityConnector();

		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const signedProof: IProof = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			type: "DataIntegrityProof",
			cryptosuite: "eddsa-jcs-2022",
			created: "2024-01-31T16:00:45.490Z",
			verificationMethod:
				"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#my-verification-id",
			proofPurpose: "assertionMethod",
			proofValue:
				"z2zGoejwpX6HH2T11BZaniEVZrqRKDpwbQSvPcL7eL9M7hV5P9zQQZxs85n6qyDzkkXCL8aFUWfwQD5bxVGqDK1fa"
		};

		const verified = await identityConnector.verifyProof(unsecuredDocument, signedProof);
		expect(verified).toBeTruthy();
	});
});

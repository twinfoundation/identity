// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n, RandomHelper } from "@twin.org/core";
import { Bip39 } from "@twin.org/crypto";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	EntityStorageIdentityResolverConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@twin.org/identity-connector-entity-storage";
import {
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import { DidContexts, DidVerificationMethodType } from "@twin.org/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { IdentityResolverService } from "../src/identityResolverService";
import { IdentityService } from "../src/identityService";

export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;

describe("IdentityService", () => {
	beforeAll(async () => {
		I18n.addDictionary("en", await import("../locales/en.json"));

		initSchemaVault();
		initSchemaIdentity();

		identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>()
		});

		vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>()
		});

		const vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>()
		});

		EntityStorageConnectorFactory.register(
			"identity-document",
			() => identityDocumentEntityStorage
		);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorageConnector);

		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		IdentityConnectorFactory.register("entity-storage", () => new EntityStorageIdentityConnector());
		IdentityResolverConnectorFactory.register(
			"entity-storage",
			() => new EntityStorageIdentityResolverConnector()
		);
	});

	beforeEach(() => {
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

		vi.useFakeTimers().setSystemTime(new Date("2020-01-01"));
	});

	test("Can create identity service", () => {
		const service = new IdentityService();

		expect(service).toBeDefined();
	});

	test("Can create an identity", async () => {
		const service = new IdentityService();

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);

		expect(identity).toEqual({
			"@context": DidContexts.Context,
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			service: [
				{
					id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#revocation",
					type: "BitstringStatusList",
					serviceEndpoint:
						"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
				}
			]
		});
	});

	test("Can create a verification method", async () => {
		const service = new IdentityService();

		const verificationMethod = await service.verificationMethodCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			DidVerificationMethodType.AssertionMethod,
			undefined,
			TEST_CONTROLLER
		);

		expect(verificationMethod).toEqual({
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo",
			controller:
				"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			type: "JsonWebKey",
			publicKeyJwk: {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: "RM9uVI3LuYa2n3UG1dcZcVoVjCV5rvfLS_uf33sq2bM",
				kid: "hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo"
			}
		});

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.assertionMethod).toHaveLength(1);
	});

	test("Can remove a verification method", async () => {
		const service = new IdentityService();

		await service.verificationMethodRemove(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo",
			TEST_CONTROLLER
		);

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.assertionMethod).toBeUndefined();
	});

	test("Can create a service", async () => {
		const service = new IdentityService();

		const createdService = await service.serviceCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			"linked-domain",
			"LinkedDomains",
			"https://bar.example.com/",
			TEST_CONTROLLER
		);

		expect(createdService).toEqual({
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#linked-domain",
			type: "LinkedDomains",
			serviceEndpoint: "https://bar.example.com/"
		});

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.service).toHaveLength(2);
	});

	test("Can remove a service", async () => {
		const service = new IdentityService();

		await service.serviceRemove(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#linked-domain",
			TEST_CONTROLLER
		);

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.service).toHaveLength(1);
	});

	test("Can create a verifiable credential", async () => {
		const service = new IdentityService();

		const verificationMethod = await service.verificationMethodCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			DidVerificationMethodType.AssertionMethod,
			undefined,
			TEST_CONTROLLER
		);

		const vc = await service.verifiableCredentialCreate(
			verificationMethod.id,
			"https://example.com/credentials/3732",
			{
				"@context": "https://schema.org",
				"@type": "Person",
				name: "Jane Doe"
			},
			5,
			TEST_CONTROLLER
		);

		expect(vc).toEqual({
			verifiableCredential: {
				"@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org"],
				id: "https://example.com/credentials/3732",
				type: ["VerifiableCredential", "Person"],
				credentialSubject: {
					name: "Jane Doe"
				},
				issuer:
					"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
				issuanceDate: "2020-01-01T00:00:00.000Z",
				credentialStatus: {
					id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#revocation",
					type: "BitstringStatusList",
					revocationBitmapIndex: "5"
				}
			},
			jwt: "eyJraWQiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHgwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxI2hHSEdzMER4TEFXY2d6eDBRalRiekpjM1BPLU5NcVNGQVBjZGd6eF9xUW8iLCJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHgwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxIiwibmJmIjoxNTc3ODM2ODAwLCJqdGkiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWxzLzM3MzIiLCJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3NjaGVtYS5vcmciXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIlBlcnNvbiJdLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjoiSmFuZSBEb2UifSwiY3JlZGVudGlhbFN0YXR1cyI6eyJpZCI6ImRpZDplbnRpdHktc3RvcmFnZToweDAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEjcmV2b2NhdGlvbiIsInR5cGUiOiJCaXRzdHJpbmdTdGF0dXNMaXN0IiwicmV2b2NhdGlvbkJpdG1hcEluZGV4IjoiNSJ9fX0.k09un1ysCcvOqgG-hqhZskQxsUapS6azaIlue-9a7OqfPobG5K29UlI3_LvHN21G4k5qKGMQZi11TwU1QHDYCw"
		});
	});
});

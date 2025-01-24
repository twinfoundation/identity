// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n } from "@twin.org/core";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVaultConnector,
	initSchema as initSchemaVault,
	type VaultKey,
	type VaultSecret
} from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument";
import type { IdentityProfile } from "../src/entities/identityProfile";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector";
import { EntityStorageIdentityProfileConnector } from "../src/entityStorageIdentityProfileConnector";
import { initSchema } from "../src/schema";

export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let identityProfileEntityStorage: MemoryEntityStorageConnector<IdentityProfile>;

describe("EntityStorageIdentityProfileConnector", () => {
	beforeAll(async () => {
		I18n.addDictionary("en", await import("../locales/en.json"));

		initSchemaVault();
		initSchema();
	});

	beforeEach(async () => {
		identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>()
		});

		identityProfileEntityStorage = new MemoryEntityStorageConnector<IdentityProfile>({
			entitySchema: nameof<IdentityProfile>()
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
		EntityStorageConnectorFactory.register("identity-profile", () => identityProfileEntityStorage);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorageConnector);

		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		IdentityConnectorFactory.register("identity", () => new EntityStorageIdentityConnector());
	});

	test("Can fail to get an identity when connector fails", async () => {
		identityProfileEntityStorage.get = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new EntityStorageIdentityProfileConnector();

		await expect(service.get("foo")).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityProfileConnector.getFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.entityStorageIdentityProfileConnector.getFailed")).toEqual(true);
	});

	test("Can fail to get an identity when it doesn't exist", async () => {
		const service = new EntityStorageIdentityProfileConnector();

		await expect(service.get("foo")).rejects.toMatchObject({
			name: "NotFoundError",
			message: "entityStorageIdentityProfileConnector.getFailed",
			properties: { notFoundId: "foo" }
		});

		expect(I18n.hasMessage("error.entityStorageIdentityProfileConnector.getFailed")).toEqual(true);
	});

	test("Can get an identity", async () => {
		const identityService = new EntityStorageIdentityConnector();
		const identityResult = await identityService.createDocument(TEST_CONTROLLER);

		const service = new EntityStorageIdentityProfileConnector();

		await service.create(
			identityResult.id,
			{
				"@context": "https://schema.org",
				"@type": "Person",
				name: "Jane Doe",
				jobTitle: "Professor",
				telephone: "(425) 123-4567",
				url: "http://www.janedoe.com"
			},
			{
				"@context": {
					name: "https://schema.org/name",
					description: "https://schema.org/description",
					image: {
						"@id": "https://schema.org/image",
						"@type": "@id"
					},
					geo: "https://schema.org/geo",
					latitude: {
						"@id": "https://schema.org/latitude",
						"@type": "xsd:float"
					},
					longitude: {
						"@id": "https://schema.org/longitude",
						"@type": "xsd:float"
					},
					xsd: "http://www.w3.org/2001/XMLSchema#"
				},
				description: "The Empire State Building is a 102-story landmark in New York City.",
				geo: {
					latitude: "40.75",
					longitude: "73.98"
				},
				image: "http://www.civil.usherbrooke.ca/cours/gci215a/empire-state-building.jpg",
				name: "The Empire State Building"
			}
		);

		const identity = await service.get(identityResult.id);

		expect(identity.publicProfile).toEqual({
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe",
			jobTitle: "Professor",
			telephone: "(425) 123-4567",
			url: "http://www.janedoe.com"
		});
		expect(identity.privateProfile).toEqual({
			"@context": {
				name: "https://schema.org/name",
				description: "https://schema.org/description",
				image: {
					"@id": "https://schema.org/image",
					"@type": "@id"
				},
				geo: "https://schema.org/geo",
				latitude: {
					"@id": "https://schema.org/latitude",
					"@type": "xsd:float"
				},
				longitude: {
					"@id": "https://schema.org/longitude",
					"@type": "xsd:float"
				},
				xsd: "http://www.w3.org/2001/XMLSchema#"
			},
			description: "The Empire State Building is a 102-story landmark in New York City.",
			geo: {
				latitude: "40.75",
				longitude: "73.98"
			},
			image: "http://www.civil.usherbrooke.ca/cours/gci215a/empire-state-building.jpg",
			name: "The Empire State Building"
		});
	});

	test("Can get an identity with subset of properties", async () => {
		const identityService = new EntityStorageIdentityConnector();
		const identityResult = await identityService.createDocument(TEST_CONTROLLER);

		const service = new EntityStorageIdentityProfileConnector<{
			"@context": string;
			"@type": "Person";
			name: string;
		}>();

		await service.create(identityResult.id, {
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe"
		});

		const identity = await service.get(identityResult.id, ["name"]);

		expect(identity.publicProfile).toEqual({
			name: "Jane Doe"
		});
	});

	test("Can fail to update an identity when connector fails", async () => {
		identityProfileEntityStorage.get = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new EntityStorageIdentityProfileConnector();

		await expect(service.update(TEST_IDENTITY_ID, [])).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityProfileConnector.updateFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.entityStorageIdentityProfileConnector.updateFailed")).toEqual(
			true
		);
	});

	test("Can fail to update an identity when it doesn't exist", async () => {
		const service = new EntityStorageIdentityProfileConnector();

		await expect(service.update(TEST_IDENTITY_ID, [])).rejects.toMatchObject({
			name: "NotFoundError",
			source: "EntityStorageIdentityProfileConnector",
			message: "entityStorageIdentityProfileConnector.notFound",
			properties: { notFoundId: TEST_IDENTITY_ID }
		});

		expect(I18n.hasMessage("error.entityStorageIdentityProfileConnector.updateFailed")).toEqual(
			true
		);
	});

	test("Can update an identity", async () => {
		const service = new EntityStorageIdentityProfileConnector();

		const identityService = new EntityStorageIdentityConnector();
		const identityResult = await identityService.createDocument(TEST_CONTROLLER);

		await service.create(identityResult.id, {
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe",
			jobTitle: "Professor",
			telephone: "(425) 123-4567",
			url: "http://www.janedoe.com"
		});

		const profile = identityProfileEntityStorage.getStore();
		expect(profile?.[0].publicProfile).toEqual({
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe",
			jobTitle: "Professor",
			telephone: "(425) 123-4567",
			url: "http://www.janedoe.com"
		});

		await service.update(identityResult.id, {
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe2",
			jobTitle: "Professor2",
			telephone: "(425) 123-45672",
			url: "http://www.janedoe.com2"
		});

		const profile2 = identityProfileEntityStorage.getStore();
		expect(profile2?.[0].identity).toEqual(identityResult.id);
		expect(profile2?.[0].publicProfile).toEqual({
			"@context": "https://schema.org",
			"@type": "Person",
			name: "Jane Doe2",
			jobTitle: "Professor2",
			telephone: "(425) 123-45672",
			url: "http://www.janedoe.com2"
		});
	});

	test("Can fail get a list of identities when connector fails", async () => {
		identityProfileEntityStorage.query = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new EntityStorageIdentityProfileConnector();

		await expect(service.list()).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityProfileConnector.listFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.entityStorageIdentityProfileConnector.listFailed")).toEqual(true);
	});

	test("Can get a list of identities including private properties", async () => {
		const identityService = new EntityStorageIdentityConnector();
		const service = new EntityStorageIdentityProfileConnector();

		for (let i = 0; i < 3; i++) {
			const identity = await identityService.createDocument(TEST_CONTROLLER);
			await service.create(identity.id, {
				"@context": "https://schema.org",
				"@type": "Person",
				name: `Test Node Identity ${i}`,
				role: "node"
			});
		}

		for (let i = 0; i < 7; i++) {
			const identity = await identityService.createDocument(TEST_CONTROLLER);
			await service.create(identity.id, {
				"@context": "https://schema.org",
				"@type": "Person",
				name: `Test User Identity ${i}`,
				role: "user"
			});
		}

		const identitiesNode = await service.list([
			{
				propertyName: "role",
				propertyValue: "node"
			}
		]);
		expect(identitiesNode.items.length).toEqual(3);

		const identitiesUsers = await service.list([
			{
				propertyName: "role",
				propertyValue: "user"
			}
		]);
		expect(identitiesUsers.items.length).toEqual(7);
	});
});

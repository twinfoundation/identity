// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n } from "@gtsc/core";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import {
	IdentityConnectorFactory,
	IdentityRole,
	type IIdentityProfileProperty
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper } from "@gtsc/schema";
import {
	EntityStorageVaultConnector,
	initSchema as initSchemaVault,
	type VaultKey,
	type VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
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

		const properties: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity", { isPublic: true });
		await service.create(identityResult.id, properties);

		const identity = await service.get(identityResult.id);

		expect(identity.properties?.[0].key).toEqual("name");
		expect(identity.properties?.[0].type).toEqual("https://schema.org/Text");
		expect(identity.properties?.[0].value).toEqual("Test Identity");
		expect(identity.properties?.[0].isPublic).toEqual(true);
	});

	test("Can get an identity only public properties", async () => {
		const identityService = new EntityStorageIdentityConnector();
		const identityResult = await identityService.createDocument(TEST_CONTROLLER);

		const service = new EntityStorageIdentityProfileConnector();

		const properties: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity", { isPublic: true });
		PropertyHelper.setText(properties, "type", "Test", { isPublic: false });
		await service.create(identityResult.id, properties);

		const identity = await service.get(identityResult.id, false);

		expect(identity.properties?.[0].key).toEqual("name");
		expect(identity.properties?.[0].type).toEqual("https://schema.org/Text");
		expect(identity.properties?.[0].value).toEqual("Test Identity");
		expect(identity.properties?.[0].isPublic).toEqual(true);
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

		const properties1: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties1, "name", "Test Identity 1", { isPublic: true });

		await service.create(identityResult.id, properties1);

		const profile = identityProfileEntityStorage.getStore();
		expect(profile?.[0].identity).toEqual(identityResult.id);
		expect(profile?.[0].properties?.name?.type).toEqual("https://schema.org/Text");
		expect(profile?.[0].properties?.name?.value).toEqual("Test Identity 1");
		expect(profile?.[0].properties?.name?.isPublic).toEqual(true);

		const properties2: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties2, "name", "Test Identity 2", { isPublic: false });

		await service.update(identityResult.id, properties2);

		const profile2 = identityProfileEntityStorage.getStore();
		expect(profile2?.[0].identity).toEqual(identityResult.id);
		expect(profile2?.[0].properties?.name?.type).toEqual("https://schema.org/Text");
		expect(profile2?.[0].properties?.name?.value).toEqual("Test Identity 2");
		expect(profile2?.[0].properties?.name?.isPublic).toEqual(false);
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
			const properties: IIdentityProfileProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test Node Identity ${i}`);
			PropertyHelper.setText(properties, "role", IdentityRole.Node);
			const identity = await identityService.createDocument(TEST_CONTROLLER);
			await service.create(identity.id, properties);
		}

		for (let i = 0; i < 7; i++) {
			const properties: IIdentityProfileProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test User Identity ${i}`);
			PropertyHelper.setText(properties, "role", IdentityRole.User);
			const identity = await identityService.createDocument(TEST_CONTROLLER);
			await service.create(identity.id, properties);
		}

		const identitiesNode = await service.list(true, [
			{
				propertyName: "role",
				propertyValue: IdentityRole.Node
			}
		]);
		expect(identitiesNode.items.length).toEqual(3);

		const identitiesUsers = await service.list(true, [
			{
				propertyName: "role",
				propertyValue: IdentityRole.User
			}
		]);
		expect(identitiesUsers.items.length).toEqual(7);
	});

	test("Can get a list of identities including only public properties", async () => {
		const identityService = new EntityStorageIdentityConnector();
		const service = new EntityStorageIdentityProfileConnector();

		for (let i = 0; i < 3; i++) {
			const properties: IIdentityProfileProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test Node Identity ${i}`, { isPublic: true });
			PropertyHelper.setText(properties, "role", IdentityRole.Node, { isPublic: true });
			PropertyHelper.setText(properties, "foo", "bar", { isPublic: false });
			const identity = await identityService.createDocument(TEST_CONTROLLER);
			await service.create(identity.id, properties);
		}

		const identitiesNode = await service.list(false, [
			{
				propertyName: "role",
				propertyValue: IdentityRole.Node
			}
		]);

		expect(identitiesNode.items.length).toEqual(3);
		expect(identitiesNode.items[0].properties?.length).toEqual(2);
		expect(identitiesNode.items[0].properties?.[0]?.value).toEqual("Test Node Identity 0");
		expect(identitiesNode.items[0].properties?.[1]?.value).toEqual(IdentityRole.Node);
	});
});

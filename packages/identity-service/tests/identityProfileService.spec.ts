// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n } from "@gtsc/core";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@gtsc/identity-connector-entity-storage";
import {
	IdentityConnectorFactory,
	IdentityRole,
	type IIdentityProfileProperty
} from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper } from "@gtsc/schema";
import type { IServiceRequestContext } from "@gtsc/services";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import type { IdentityProfile } from "../src/entities/identityProfile";
import { IdentityProfileService } from "../src/identityProfileService";
import { IdentityService } from "../src/identityService";
import { initSchema } from "../src/schema";

export const TEST_PARTITION_ID = "test-parition";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";
export const TEST_CONTEXT: IServiceRequestContext = {
	partitionId: TEST_PARTITION_ID,
	identity: TEST_IDENTITY_ID
};

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let identityProfileEntityStorage: MemoryEntityStorageConnector<IdentityProfile>;

describe("IdentityProfileService", () => {
	beforeAll(async () => {
		I18n.addDictionary("en", await import("../locales/en.json"));

		initSchemaVault();
		initSchemaIdentity();
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

		const service = new IdentityProfileService();

		await expect(service.get("foo", undefined, TEST_CONTEXT)).rejects.toMatchObject({
			name: "GeneralError",
			message: "identityProfileService.getFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.identityProfileService.getFailed")).toEqual(true);
	});

	test("Can fail to get an identity when it doesn't exist", async () => {
		const service = new IdentityProfileService();

		await expect(service.get("foo", undefined, TEST_CONTEXT)).rejects.toMatchObject({
			name: "NotFoundError",
			message: "identityProfileService.getFailed",
			properties: { notFoundId: "foo" }
		});

		expect(I18n.hasMessage("error.identityProfileService.getFailed")).toEqual(true);
	});

	test("Can get an identity", async () => {
		const identityService = new IdentityService();
		const identityResult = await identityService.create(TEST_CONTROLLER, TEST_CONTEXT);

		const service = new IdentityProfileService();

		const properties: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity", { isPublic: true });
		await service.create(identityResult.identity, properties, {
			partitionId: TEST_PARTITION_ID,
			identity: identityResult.identity
		});

		const identity = await service.get(identityResult.identity, undefined, TEST_CONTEXT);

		expect(identity.properties?.length).toEqual(1);
		expect(identity.properties?.length).toEqual(1);
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

		const service = new IdentityProfileService();

		await expect(service.update(TEST_IDENTITY_ID, [], TEST_CONTEXT)).rejects.toMatchObject({
			name: "GeneralError",
			message: "identityProfileService.updateFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.identityProfileService.updateFailed")).toEqual(true);
	});

	test("Can fail to update an identity when it doesn't exist", async () => {
		const service = new IdentityProfileService();

		await expect(service.update(TEST_IDENTITY_ID, [], TEST_CONTEXT)).rejects.toMatchObject({
			name: "NotFoundError",
			source: "IdentityProfileService",
			message: "identityProfileService.notFound",
			properties: { notFoundId: TEST_IDENTITY_ID }
		});

		expect(I18n.hasMessage("error.identityProfileService.updateFailed")).toEqual(true);
	});

	test("Can fail to update an identity when it doesn't match the authenticated user", async () => {
		const service = new IdentityProfileService();

		await expect(service.update("foo", [], TEST_CONTEXT)).rejects.toMatchObject({
			name: "UnauthorizedError",
			source: "IdentityProfileService",
			message: "identityProfileService.mismatch"
		});

		expect(I18n.hasMessage("error.identityProfileService.mismatch")).toEqual(true);
	});

	test("Can update an identity", async () => {
		const service = new IdentityProfileService();

		const identityService = new IdentityService();
		const identityResult = await identityService.create(TEST_CONTROLLER, TEST_CONTEXT);

		const properties1: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties1, "name", "Test Identity 1", { isPublic: true });

		await service.create(identityResult.identity, properties1, {
			partitionId: TEST_PARTITION_ID,
			identity: identityResult.identity
		});

		const profile = identityProfileEntityStorage.getStore(TEST_PARTITION_ID);
		expect(profile?.[0].identity).toEqual(identityResult.identity);
		expect(profile?.[0].properties?.length).toEqual(1);
		expect(profile?.[0].properties?.[0].key).toEqual("name");
		expect(profile?.[0].properties?.[0].type).toEqual("https://schema.org/Text");
		expect(profile?.[0].properties?.[0].value).toEqual("Test Identity 1");
		expect(profile?.[0].properties?.[0].isPublic).toEqual(true);

		const properties2: IIdentityProfileProperty[] = [];
		PropertyHelper.setText(properties2, "name", "Test Identity 2", { isPublic: false });

		await service.update(identityResult.identity, properties2, {
			partitionId: TEST_PARTITION_ID,
			identity: identityResult.identity
		});

		const profile2 = identityProfileEntityStorage.getStore(TEST_PARTITION_ID);
		expect(profile2?.[0].identity).toEqual(identityResult.identity);
		expect(profile2?.[0].properties?.length).toEqual(1);
		expect(profile2?.[0].properties?.[0].key).toEqual("name");
		expect(profile2?.[0].properties?.[0].type).toEqual("https://schema.org/Text");
		expect(profile2?.[0].properties?.[0].value).toEqual("Test Identity 2");
		expect(profile2?.[0].properties?.[0].isPublic).toEqual(false);
	});

	test("Can fail get a list of identities when connector fails", async () => {
		identityProfileEntityStorage.query = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new IdentityProfileService();

		await expect(
			service.list(undefined, undefined, undefined, undefined, TEST_CONTEXT)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "identityProfileService.listFailed",
			inner: { name: "Error", message: "Test Error" }
		});

		expect(I18n.hasMessage("error.identityProfileService.listFailed")).toEqual(true);
	});

	test("Can get a list of identities", async () => {
		const identityService = new IdentityService();
		const service = new IdentityProfileService();

		for (let i = 0; i < 3; i++) {
			const properties: IIdentityProfileProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test Node Identity ${i}`);
			PropertyHelper.setText(properties, "role", IdentityRole.Node);
			const identity = await identityService.create(TEST_CONTROLLER, TEST_CONTEXT);
			await service.create(identity.identity, properties, {
				partitionId: TEST_PARTITION_ID,
				identity: identity.identity
			});
		}

		for (let i = 0; i < 7; i++) {
			const properties: IIdentityProfileProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test User Identity ${i}`);
			PropertyHelper.setText(properties, "role", IdentityRole.User);
			const identity = await identityService.create(TEST_CONTROLLER, TEST_CONTEXT);
			await service.create(identity.identity, properties, {
				partitionId: TEST_PARTITION_ID,
				identity: identity.identity
			});
		}

		const identitiesNode = await service.list(
			[
				{
					propertyName: "role",
					propertyValue: IdentityRole.Node
				}
			],
			undefined,
			undefined,
			undefined,
			TEST_CONTEXT
		);
		expect(identitiesNode.items.length).toEqual(3);

		const identitiesUsers = await service.list(
			[
				{
					propertyName: "role",
					propertyValue: IdentityRole.User
				}
			],
			undefined,
			undefined,
			undefined,
			TEST_CONTEXT
		);
		expect(identitiesUsers.items.length).toEqual(7);
	});
});

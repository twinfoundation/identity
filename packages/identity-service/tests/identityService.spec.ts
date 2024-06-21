// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n, Is } from "@gtsc/core";
import { EntitySchemaFactory, EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	IdentityDocument
} from "@gtsc/identity-connector-entity-storage";
import { IdentityConnectorFactory, IdentityRole } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper, type IProperty } from "@gtsc/schema";
import type { IRequestContext } from "@gtsc/services";
import type { IDidDocument } from "@gtsc/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import { IdentityProfile } from "../src/entities/identityProfile";
import { IdentityService } from "../src/identityService";

export const TEST_TENANT_ID = "test-tenant";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";
export const TEST_CONTEXT: IRequestContext = {
	tenantId: TEST_TENANT_ID,
	identity: TEST_IDENTITY_ID
};

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let identityProfileEntityStorage: MemoryEntityStorageConnector<IdentityProfile>;

describe("IdentityService", () => {
	beforeAll(async () => {
		I18n.addDictionary("en", await import("../locales/en.json"));

		EntitySchemaFactory.register(nameof(VaultKey), () => EntitySchemaHelper.getSchema(VaultKey));
		EntitySchemaFactory.register(nameof(VaultSecret), () =>
			EntitySchemaHelper.getSchema(VaultSecret)
		);
		EntitySchemaFactory.register(nameof(IdentityDocument), () =>
			EntitySchemaHelper.getSchema(IdentityDocument)
		);
		EntitySchemaFactory.register(nameof(IdentityProfile), () =>
			EntitySchemaHelper.getSchema(IdentityProfile)
		);
	});

	beforeEach(() => {
		identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof(IdentityDocument)
		});

		identityProfileEntityStorage = new MemoryEntityStorageConnector<IdentityProfile>({
			entitySchema: nameof(IdentityProfile)
		});

		vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof(VaultKey)
		});

		const vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof(VaultSecret)
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

	test("Can create identity service", () => {
		const service = new IdentityService();

		expect(service).toBeDefined();
	});

	test("Can fail to create identity when storage fails", async () => {
		identityProfileEntityStorage.set = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new IdentityService();

		const properties: IProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity");

		expect(
			service.identityCreate(TEST_CONTEXT, TEST_CONTROLLER, IdentityRole.Node, properties)
		).rejects.toMatchObject(
			expect.objectContaining({
				name: "GeneralError",
				source: "IdentityService",
				message: "identityService.identityCreateFailed"
			})
		);

		expect(I18n.hasMessage("error.identityService.identityCreateFailed")).toEqual(true);
	});

	test("Can create identity", async () => {
		const service = new IdentityService();

		const properties: IProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity");

		const identityResult = await service.identityCreate(
			TEST_CONTEXT,
			TEST_CONTROLLER,
			IdentityRole.Node,
			properties
		);

		expect(identityResult.identity).toBeDefined();

		const vaultData = vaultKeyEntityStorageConnector.getStore(TEST_TENANT_ID);
		expect(vaultData?.[0].id).toEqual(`${TEST_IDENTITY_ID}/${identityResult.identity}`);
		expect(vaultData?.[0].type).toEqual(0);
		expect(Is.stringBase64(vaultData?.[0].privateKey)).toEqual(true);
		expect(Is.stringBase64(vaultData?.[0].publicKey)).toEqual(true);

		const documentData = identityDocumentEntityStorage.getStore(TEST_TENANT_ID);
		expect(documentData?.[0].id).toEqual(identityResult.identity);
		expect(Is.json(documentData?.[0].document)).toEqual(true);

		const documentJson = JSON.parse(documentData?.[0].document ?? "") as IDidDocument;
		expect(documentJson.id).toEqual(identityResult.identity);

		const profile = identityProfileEntityStorage.getStore(TEST_TENANT_ID);
		expect(profile?.[0].identity).toEqual(identityResult.identity);
		expect(profile?.[0].role).toEqual("node");
		expect(profile?.[0].properties?.length).toEqual(1);
		expect(profile?.[0].properties?.[0].key).toEqual("name");
		expect(profile?.[0].properties?.[0].type).toEqual("https://schema.org/Text");
		expect(profile?.[0].properties?.[0].value).toEqual("Test Identity");

		expect(I18n.hasMessage("error.identityService.identityCreateFailed")).toEqual(true);
	});

	test("Can fail to get an identity when connector fails", async () => {
		identityProfileEntityStorage.get = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new IdentityService();

		await expect(service.identityGet(TEST_CONTEXT, "foo")).rejects.toMatchObject(
			expect.objectContaining({
				name: "GeneralError",
				message: "identityService.identityGetFailed",
				inner: { name: "Error", message: "Test Error" }
			})
		);

		expect(I18n.hasMessage("error.identityService.identityGetFailed")).toEqual(true);
	});

	test("Can fail to get an identity when it doesn't exist", async () => {
		const service = new IdentityService();

		await expect(service.identityGet(TEST_CONTEXT, "foo")).rejects.toMatchObject(
			expect.objectContaining({
				name: "NotFoundError",
				message: "identityService.identityGetFailed",
				properties: { notFoundId: "foo" }
			})
		);

		expect(I18n.hasMessage("error.identityService.identityGetFailed")).toEqual(true);
	});

	test("Can get an identity", async () => {
		const service = new IdentityService();

		const properties: IProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity");
		const identityResult = await service.identityCreate(
			TEST_CONTEXT,
			TEST_CONTROLLER,
			IdentityRole.Node,
			properties
		);

		const identity = await service.identityGet(TEST_CONTEXT, identityResult.identity);

		expect(identity.role).toEqual("node");

		expect(identity?.properties?.length).toEqual(1);
		expect(identity?.properties?.[0].key).toEqual("name");
		expect(identity?.properties?.[0].type).toEqual("https://schema.org/Text");
		expect(identity?.properties?.[0].value).toEqual("Test Identity");
	});

	test("Can fail to update an identity when connector fails", async () => {
		identityProfileEntityStorage.get = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new IdentityService();

		await expect(service.identityUpdate(TEST_CONTEXT, TEST_IDENTITY_ID, [])).rejects.toMatchObject(
			expect.objectContaining({
				name: "GeneralError",
				message: "identityService.identityUpdateFailed",
				inner: { name: "Error", message: "Test Error" }
			})
		);

		expect(I18n.hasMessage("error.identityService.identityUpdateFailed")).toEqual(true);
	});

	test("Can fail to update an identity when it doesn't exist", async () => {
		const service = new IdentityService();

		await expect(service.identityUpdate(TEST_CONTEXT, TEST_IDENTITY_ID, [])).rejects.toMatchObject(
			expect.objectContaining({
				name: "NotFoundError",
				source: "IdentityService",
				message: "identityService.identityUpdateFailed",
				properties: { notFoundId: TEST_IDENTITY_ID }
			})
		);

		expect(I18n.hasMessage("error.identityService.identityUpdateFailed")).toEqual(true);
	});

	test("Can fail to update an identity when it doesn't match the authenticated user", async () => {
		const service = new IdentityService();

		await expect(service.identityUpdate(TEST_CONTEXT, "foo", [])).rejects.toMatchObject(
			expect.objectContaining({
				name: "UnauthorizedError",
				source: "IdentityService",
				message: "identityService.identityMismatch"
			})
		);

		expect(I18n.hasMessage("error.identityService.identityMismatch")).toEqual(true);
	});

	test("Can update an identity", async () => {
		const service = new IdentityService();

		const properties: IProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity");
		const identityResult = await service.identityCreate(
			TEST_CONTEXT,
			TEST_CONTROLLER,
			IdentityRole.Node,
			properties
		);

		PropertyHelper.setText(properties, "name", "Test Identity 2");

		await service.identityUpdate(
			{ tenantId: TEST_TENANT_ID, identity: identityResult.identity },
			identityResult.identity,
			properties
		);

		const profile = identityProfileEntityStorage.getStore(TEST_TENANT_ID);
		expect(profile?.[0].identity).toEqual(identityResult.identity);
		expect(profile?.[0].role).toEqual("node");
		expect(profile?.[0].properties?.length).toEqual(1);
		expect(profile?.[0].properties?.[0].key).toEqual("name");
		expect(profile?.[0].properties?.[0].type).toEqual("https://schema.org/Text");
		expect(profile?.[0].properties?.[0].value).toEqual("Test Identity 2");
	});

	test("Can fail get a list of identities when connector fails", async () => {
		identityProfileEntityStorage.query = vi.fn().mockImplementation(() => {
			// eslint-disable-next-line no-restricted-syntax
			throw new Error("Test Error");
		});

		const service = new IdentityService();

		await expect(service.identityList(TEST_CONTEXT, IdentityRole.Node)).rejects.toMatchObject(
			expect.objectContaining({
				name: "GeneralError",
				message: "identityService.identityListFailed",
				inner: { name: "Error", message: "Test Error" }
			})
		);

		expect(I18n.hasMessage("error.identityService.identityListFailed")).toEqual(true);
	});

	test("Can get a list of identities", async () => {
		const service = new IdentityService();

		for (let i = 0; i < 3; i++) {
			const properties: IProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test Node Identity ${i}`);
			await service.identityCreate(TEST_CONTEXT, TEST_CONTROLLER, IdentityRole.Node, properties);
		}

		for (let i = 0; i < 7; i++) {
			const properties: IProperty[] = [];
			PropertyHelper.setText(properties, "name", `Test User Identity ${i}`);
			await service.identityCreate(TEST_CONTEXT, TEST_CONTROLLER, IdentityRole.User, properties);
		}

		const identitiesNode = await service.identityList(TEST_CONTEXT, IdentityRole.Node);
		expect(identitiesNode.identities.length).toEqual(3);

		const identitiesUsers = await service.identityList(TEST_CONTEXT, IdentityRole.User);
		expect(identitiesUsers.identities.length).toEqual(7);
	});
});

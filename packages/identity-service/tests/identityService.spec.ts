// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { I18n, Is } from "@gtsc/core";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@gtsc/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@gtsc/identity-connector-entity-storage";
import { IdentityConnectorFactory } from "@gtsc/identity-models";
import { nameof } from "@gtsc/nameof";
import { PropertyHelper, type IProperty } from "@gtsc/schema";
import type { IServiceRequestContext } from "@gtsc/services";
import type { IDidDocument } from "@gtsc/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@gtsc/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import { IdentityService } from "../src/identityService";
import { initSchema } from "../src/schema";

export const TEST_PARTITION_ID = "test-partition";
export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";
export const TEST_CONTEXT: IServiceRequestContext = {
	partitionId: TEST_PARTITION_ID,
	identity: TEST_IDENTITY_ID
};

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;

describe("IdentityService", () => {
	beforeAll(async () => {
		I18n.addDictionary("en", await import("../locales/en.json"));

		initSchemaVault();
		initSchemaIdentity();
		initSchema();
	});

	beforeEach(() => {
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

		IdentityConnectorFactory.register("identity", () => new EntityStorageIdentityConnector());
	});

	test("Can create identity service", () => {
		const service = new IdentityService();

		expect(service).toBeDefined();
	});

	test("Can create identity", async () => {
		const service = new IdentityService();

		const properties: IProperty[] = [];
		PropertyHelper.setText(properties, "name", "Test Identity");

		const identityResult = await service.create(TEST_CONTROLLER, TEST_CONTEXT);

		expect(identityResult.identity).toBeDefined();

		const vaultData = vaultKeyEntityStorageConnector.getStore(TEST_PARTITION_ID);
		expect(vaultData?.[0].id).toEqual(`${identityResult.identity}/${identityResult.identity}`);
		expect(vaultData?.[0].type).toEqual(0);
		expect(Is.stringBase64(vaultData?.[0].privateKey)).toEqual(true);
		expect(Is.stringBase64(vaultData?.[0].publicKey)).toEqual(true);

		const documentData = identityDocumentEntityStorage.getStore(TEST_PARTITION_ID);
		expect(documentData?.[0].id).toEqual(identityResult.identity);
		expect(Is.json(documentData?.[0].document)).toEqual(true);

		const documentJson = JSON.parse(documentData?.[0].document ?? "") as IDidDocument;
		expect(documentJson.id).toEqual(identityResult.identity);

		expect(I18n.hasMessage("error.identityService.createFailed")).toEqual(true);
	});
});

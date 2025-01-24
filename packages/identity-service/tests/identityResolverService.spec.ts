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

describe("IdentityResolverService", () => {
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

	test("Can create identity resolver service", () => {
		const service = new IdentityResolverService();

		expect(service).toBeDefined();
	});

	test("Can create an identity", async () => {
		const service = new IdentityService();

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);

		expect(identity).toEqual({
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

	test("Can resolve an identity", async () => {
		const service = new IdentityResolverService();

		const identity = await service.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);

		expect(identity).toEqual({
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
});

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import type { IEntityStorageConnector } from "@gtsc/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	IdentityDocumentDescriptor,
	type IIdentityDocument
} from "@gtsc/identity-connector-entity-storage";
import type { IIdentityConnector } from "@gtsc/identity-models";
import {
	EntityStorageVaultConnector,
	type IVaultKey,
	type IVaultSecret,
	VaultKeyDescriptor,
	VaultSecretDescriptor
} from "@gtsc/vault-connector-entity-storage";
import type { IVaultConnector } from "@gtsc/vault-models";
import { IdentityService } from "../src/identityService";
import { IdentityProfileDescriptor } from "../src/models/identityProfileDescriptor";
import type { IIdentityProfile } from "../src/models/IIdentityProfile";

let vaultConnector: IVaultConnector;
let didDocumentEntityStorage: MemoryEntityStorageConnector<IIdentityDocument>;
let profileEntityStorageConnector: MemoryEntityStorageConnector<IIdentityProfile>;

describe("IdentityService", () => {
	beforeEach(() => {
		vaultConnector = new EntityStorageVaultConnector({
			vaultKeyEntityStorageConnector: new MemoryEntityStorageConnector<IVaultKey>(
				VaultKeyDescriptor
			),
			vaultSecretEntityStorageConnector: new MemoryEntityStorageConnector<IVaultSecret>(
				VaultSecretDescriptor
			)
		});
		profileEntityStorageConnector = new MemoryEntityStorageConnector<IIdentityProfile>(
			IdentityProfileDescriptor
		);
		didDocumentEntityStorage = new MemoryEntityStorageConnector<IIdentityDocument>(
			IdentityDocumentDescriptor
		);
	});

	test("Can fail to create identity service with no dependencies", () => {
		expect(
			() =>
				new IdentityService(
					undefined as unknown as {
						vaultConnector: IVaultConnector;
						identityConnector: IIdentityConnector;
						profileEntityStorageConnector: IEntityStorageConnector<IIdentityProfile>;
					}
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies",
					value: "undefined"
				}
			})
		);
	});

	test("Can fail to create identity service with no vault connector", () => {
		expect(
			() =>
				new IdentityService(
					{} as unknown as {
						vaultConnector: IVaultConnector;
						identityConnector: IIdentityConnector;
						profileEntityStorageConnector: IEntityStorageConnector<IIdentityProfile>;
					}
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.vaultConnector",
					value: "undefined"
				}
			})
		);
	});

	test("Can fail to create identity service with no identity connector", () => {
		expect(
			() =>
				new IdentityService({ vaultConnector: {} } as unknown as {
					vaultConnector: IVaultConnector;
					identityConnector: IIdentityConnector;
					profileEntityStorageConnector: IEntityStorageConnector<IIdentityProfile>;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.identityConnector",
					value: "undefined"
				}
			})
		);
	});

	test("Can fail to create identity service with no profile entity storage connector", () => {
		expect(
			() =>
				new IdentityService({ vaultConnector: {}, identityConnector: {} } as unknown as {
					vaultConnector: IVaultConnector;
					identityConnector: IIdentityConnector;
					profileEntityStorageConnector: IEntityStorageConnector<IIdentityProfile>;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.profileEntityStorageConnector",
					value: "undefined"
				}
			})
		);
	});

	test("Can create identity service", () => {
		const service = new IdentityService({
			vaultConnector,
			identityConnector: new EntityStorageIdentityConnector({
				vaultConnector,
				didDocumentEntityStorage
			}),
			profileEntityStorageConnector
		});

		expect(service).toBeDefined();
	});
});

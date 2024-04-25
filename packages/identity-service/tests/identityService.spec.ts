// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityStorageProvider } from "@gtsc/entity-storage-provider-models";
import type { IIdentityProvider } from "@gtsc/identity-provider-models";
import type { IVaultProvider } from "@gtsc/vault-provider-models";
import { IdentityService } from "../src/identityService";
import type { IIdentityProfile } from "../src/models/IIdentityProfile";

describe("IdentityService", () => {
	test("Can fail to create identity service with no dependencies", () => {
		expect(
			() =>
				new IdentityService(
					undefined as unknown as {
						vaultProvider: IVaultProvider;
						identityProvider: IIdentityProvider;
						profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
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

	test("Can fail to create identity service with no vault provider", () => {
		expect(
			() =>
				new IdentityService(
					{} as unknown as {
						vaultProvider: IVaultProvider;
						identityProvider: IIdentityProvider;
						profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
					}
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.vaultProvider",
					value: "undefined"
				}
			})
		);
	});

	test("Can fail to create identity service with no identity provider", () => {
		expect(
			() =>
				new IdentityService({ vaultProvider: {} } as unknown as {
					vaultProvider: IVaultProvider;
					identityProvider: IIdentityProvider;
					profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.identityProvider",
					value: "undefined"
				}
			})
		);
	});

	test("Can fail to create identity service with no profile storage provider", () => {
		expect(
			() =>
				new IdentityService({ vaultProvider: {}, identityProvider: {} } as unknown as {
					vaultProvider: IVaultProvider;
					identityProvider: IIdentityProvider;
					profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.profileStorageProvider",
					value: "undefined"
				}
			})
		);
	});

	test("Can create identity service with dependencies", () => {
		expect(
			() =>
				new IdentityService({ vaultProvider: {}, identityProvider: {} } as unknown as {
					vaultProvider: IVaultProvider;
					identityProvider: IIdentityProvider;
					profileStorageProvider: IEntityStorageProvider<IIdentityProfile>;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "dependencies.profileStorageProvider",
					value: "undefined"
				}
			})
		);
	});
});

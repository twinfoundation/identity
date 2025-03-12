// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY_ID,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import { IotaIdentityResolverConnector } from "../src/iotaIdentityResolverConnector";
import type { IIotaIdentityResolverConnectorConfig } from "../src/models/IIotaIdentityResolverConnectorConfig";
import type { IIotaIdentityResolverConnectorConstructorOptions } from "../src/models/IIotaIdentityResolverConnectorConstructorOptions";

describe("IotaIdentityResolverConnector", () => {
	let testDocumentId: string;

	beforeAll(async () => {
		await setupTestEnv();

		// Create a document to use for testing
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		// Create a test document to resolve
		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		testDocumentId = testDocument.id;
	});

	test("can fail to construct with no options", () => {
		expect(
			() =>
				new IotaIdentityResolverConnector(
					undefined as unknown as IIotaIdentityResolverConnectorConstructorOptions
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config", () => {
		expect(
			() =>
				new IotaIdentityResolverConnector(
					{} as unknown as IIotaIdentityResolverConnectorConstructorOptions
				)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options.config",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config.clientOptions", () => {
		expect(
			() =>
				new IotaIdentityResolverConnector({ config: {} } as unknown as {
					config: IIotaIdentityResolverConnectorConfig;
				})
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "options.config.clientOptions",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to resolve a document with no id", async () => {
		const identityResolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			}
		});

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
		const identityResolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			}
		});

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		// Verify the resolved document matches what we created
		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);

		// Check that the document has the expected structure
		expect(resolvedDocument.service).toBeDefined();
		expect(resolvedDocument.service?.[0]?.id).toEqual(`${testDocumentId}#revocation`);
	});

	test("throws error for non-existent document", async () => {
		const identityResolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK
			}
		});

		const nonExistentId =
			"did:iota:testnet:0x0000000000000000000000000000000000000000000000000000000000000000";

		await expect(identityResolverConnector.resolveDocument(nonExistentId)).rejects.toThrow();
	});
});

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	setupTestEnv
	// TEST_CLIENT_OPTIONS,
	// TEST_IDENTITY_ID,
	// TEST_MNEMONIC_NAME,
	// TEST_NETWORK
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig";

describe("IotaIdentityConnector", () => {
	// let testDocumentId: string;

	beforeAll(async () => {
		await setupTestEnv();
	});

	test("can fail to construct with no options", () => {
		expect(
			() =>
				new IotaIdentityConnector(undefined as unknown as { config: IIotaIdentityConnectorConfig })
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

	// test("can create a document", async () => {
	// 	const identityConnector = new IotaIdentityConnector({
	// 		config: {
	// 			clientOptions: TEST_CLIENT_OPTIONS,
	// 			vaultMnemonicId: TEST_MNEMONIC_NAME,
	// 			network: TEST_NETWORK
	// 		}
	// 	});

	// 	const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
	// 	testDocumentId = testDocument.id;

	// 	console.debug("Created DID Document:", testDocument);

	// 	// Check that the document ID starts with did:iota
	// 	expect(testDocument.id.startsWith("did:iota")).toBeTruthy();

	// 	// Log the document ID for debugging
	// 	console.debug("DID Document ID:", testDocument.id);

	// 	// Ensure the document has the expected structure
	// 	expect(testDocument.id).toBeDefined();

	// 	// Safely check verification methods if they exist
	// 	if (testDocument.verificationMethod && testDocument.verificationMethod.length > 0) {
	// 		expect(testDocument.verificationMethod.length).toBeGreaterThan(0);
	// 	}

	// 	// Add more specific assertions based on your implementation details
	// 	// For example, check specific verification method types, service endpoints, etc.
	// });

	// test("can resolve a document", async () => {
	// 	// Skip if no document was created in the previous test
	// 	if (!testDocumentId) {
	// 		console.warn("Skipping resolve test as no document was created");
	// 		return;
	// 	}

	// 	const identityConnector = new IotaIdentityConnector({
	// 		config: {
	// 			clientOptions: TEST_CLIENT_OPTIONS,
	// 			vaultMnemonicId: TEST_MNEMONIC_NAME,
	// 			network: TEST_NETWORK
	// 		}
	// 	});

	// 	const resolvedDocument = await identityConnector.resolveDocument(testDocumentId);

	// 	// Verify the resolved document matches what we created
	// 	expect(resolvedDocument.id).toEqual(testDocumentId);

	// 	console.debug("Resolved DID Document:", resolvedDocument);
	// });
});

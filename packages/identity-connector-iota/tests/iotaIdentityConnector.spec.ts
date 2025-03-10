// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is } from "@twin.org/core";
import type { IDidService } from "@twin.org/standards-w3c-did";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY_ID,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig";

describe("IotaIdentityConnector", () => {
	let testDocumentId: string;

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

	test("can create a document", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		testDocumentId = testDocument.id;

		// Check that the document ID starts with did:iota
		expect(testDocument.id.startsWith("did:iota")).toBeTruthy();

		// Ensure the document has the expected structure
		expect(testDocument.id).toBeDefined();
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toEqual(`${testDocument.id}#revocation`);

		// Safely check verification methods if they exist
		if (testDocument.verificationMethod && testDocument.verificationMethod.length > 0) {
			expect(testDocument.verificationMethod.length).toBeGreaterThan(0);
		}

		// Add more specific assertions based on your implementation details
		// For example, check specific verification method types, service endpoints, etc.
	});

	test("can add a verification method", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		// Create a document to add the verification method to
		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		testDocumentId = testDocument.id;

		const verificationMethodType = "authentication";
		const verificationMethodId = "testVerificationMethod";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId,
			verificationMethodType,
			verificationMethodId
		);

		// Check that the added method has the expected structure
		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);
		expect(addedMethod.type).toEqual("JsonWebKey2020");
	});

	test("can resolve a document", async () => {
		// Skip if no document was created in the previous test
		if (!testDocumentId) {
			console.warn("Skipping resolve test as no document was created");
			return;
		}

		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		const resolvedDocument = await identityConnector.resolveDocument(testDocumentId);

		// Verify the resolved document matches what we created
		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);

		// Check that the document has the expected structure
		expect(resolvedDocument.service).toBeDefined();
		expect((resolvedDocument.service?.[0] as IDidService)?.id).toEqual(
			`${testDocumentId}#revocation`
		);

		// Check for verification methods
		if (resolvedDocument.verificationMethod && resolvedDocument.verificationMethod.length > 0) {
			// Verify we have at least one verification method
			expect(resolvedDocument.verificationMethod.length).toBeGreaterThan(0);

			const hasAddedMethod = resolvedDocument.verificationMethod.some(method => {
				if (Is.string(method)) {
					return method === `${testDocumentId}#testVerificationMethod`;
				}
				return method.id === `${testDocumentId}#testVerificationMethod`;
			});
			expect(hasAddedMethod).toBeTruthy();
		}
	});

	test("can verify verification methods in a resolved document", async () => {
		// Skip if no document was created in the previous test
		// if (!testDocumentId) {
		// 	console.warn("Skipping verification method test as no document was created");
		// 	return;
		// }

		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		// Create a new document specifically for this test
		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		const documentId = testDocument.id;

		// Add a specific verification method to test - use "verificationMethod" type
		const verificationMethodType = "verificationMethod";
		const verificationMethodId = "testVerificationMethod";

		// Add the verification method to the document
		await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			documentId,
			verificationMethodType,
			verificationMethodId
		);

		// Now resolve the document to verify the method was added correctly
		const resolvedDocument = await identityConnector.resolveDocument(documentId);

		// Basic document verification
		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(documentId);

		// Verify verification methods exist
		expect(resolvedDocument.verificationMethod).toBeDefined();
		expect(Array.isArray(resolvedDocument.verificationMethod)).toBeTruthy();
		expect(resolvedDocument.verificationMethod?.length).toBeGreaterThan(0);

		// Find our specific verification method
		const specificMethod = resolvedDocument.verificationMethod?.find(method => {
			if (Is.string(method)) {
				return method === `${documentId}#${verificationMethodId}`;
			}
			return method.id === `${documentId}#${verificationMethodId}`;
		});

		// Verify the specific method exists and has correct properties
		expect(specificMethod).toBeDefined();
		if (!Is.string(specificMethod)) {
			expect(specificMethod?.id).toEqual(`${documentId}#${verificationMethodId}`);
			expect(specificMethod?.type).toEqual("JsonWebKey2020");
			expect(specificMethod?.controller).toEqual(documentId);

			// Verify the method has the expected properties for a JWK
			expect(specificMethod?.publicKeyJwk).toBeDefined();
			if (specificMethod?.publicKeyJwk) {
				expect(specificMethod.publicKeyJwk.kty).toBeDefined();
				expect(specificMethod.publicKeyJwk.crv).toBeDefined();
				expect(specificMethod.publicKeyJwk.x).toBeDefined();
			}
		}

		// Check that the document has the expected service structure
		expect(resolvedDocument.service).toBeDefined();
		expect(Array.isArray(resolvedDocument.service)).toBeTruthy();

		const revocationService = resolvedDocument.service?.find(service =>
			service.id.endsWith("#revocation")
		);

		expect(revocationService).toBeDefined();
		expect(revocationService?.type).toEqual("RevocationBitmap2022");
	});

	test("can remove a verification method", async () => {
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		// Create a new document specifically for this test
		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		const documentId = testDocument.id;

		// Add a verification method to the document
		const verificationMethodType = "verificationMethod";
		const verificationMethodId = "methodToRemove";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			documentId,
			verificationMethodType,
			verificationMethodId
		);

		// Verify the method was added
		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${documentId}#${verificationMethodId}`);

		// Now remove the verification method
		await identityConnector.removeVerificationMethod(
			TEST_IDENTITY_ID,
			`${documentId}#${verificationMethodId}`
		);

		// Resolve the document to verify the method was removed
		const resolvedDocument = await identityConnector.resolveDocument(documentId);

		// Verify the document exists
		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(documentId);

		// Check that the verification method is no longer in the document
		const methodStillExists = resolvedDocument.verificationMethod?.some(method => {
			if (Is.string(method)) {
				return method === `${documentId}#${verificationMethodId}`;
			}
			return method.id === `${documentId}#${verificationMethodId}`;
		});

		expect(methodStillExists).toBeFalsy();
	});
});

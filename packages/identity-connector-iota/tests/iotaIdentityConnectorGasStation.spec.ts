// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is, GeneralError } from "@twin.org/core";
import { describe, expect, test, beforeAll } from "vitest";
import { DidVerificationMethodType } from "@twin.org/standards-w3c-did";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY_ID,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	GAS_STATION_URL,
	GAS_STATION_AUTH_TOKEN,
	GAS_BUDGET
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig";

describe("IotaIdentityConnector with Gas Station", () => {
	let gasStationConfig: IIotaIdentityConnectorConfig;
	let regularConfig: IIotaIdentityConnectorConfig;

	beforeAll(async () => {
		await setupTestEnv();

		gasStationConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			vaultMnemonicId: TEST_MNEMONIC_NAME,
			network: TEST_NETWORK,
			gasBudget: GAS_BUDGET,
			gasStation: {
				gasStationUrl: GAS_STATION_URL,
				gasStationAuthToken: GAS_STATION_AUTH_TOKEN
			}
		};

		regularConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			vaultMnemonicId: TEST_MNEMONIC_NAME,
			network: TEST_NETWORK
		};
	});

	describe("Configuration", () => {
		test("Should create identity connector with gas station configuration", () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			expect(connector).toBeDefined();
			expect(connector.CLASS_NAME).toBe("IotaIdentityConnector");
		});

		test("Should create identity connector without gas station configuration", () => {
			const connector = new IotaIdentityConnector({
				config: regularConfig
			});

			expect(connector).toBeDefined();
			expect(connector.CLASS_NAME).toBe("IotaIdentityConnector");
		});
	});

	describe("Gas Station Integration", () => {
		test("Should test gas station connectivity before attempting identity operations", async () => {
			await expect(fetch(GAS_STATION_URL, { method: "GET" })).resolves.toMatchObject({
				ok: true
			});
		}, 10000);

		test("Should create identity document using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			const document = await connector.createDocument(TEST_IDENTITY_ID);

			expect(document).toBeDefined();
			expect(document.id).toBeDefined();
			expect(Is.stringValue(document.id)).toBe(true);
			expect(document.id.includes("did:iota:")).toBe(true);
		}, 30000);

		test("Should compare regular vs gas station transaction attempts", async () => {
			const regularConnector = new IotaIdentityConnector({
				config: regularConfig
			});

			const gasStationConnector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			// Regular creation first
			const regularDocument = await regularConnector.createDocument(TEST_IDENTITY_ID);

			// Gas station creation
			const gasStationDocument = await gasStationConnector.createDocument(TEST_IDENTITY_ID);

			expect(regularDocument).toBeDefined();
			expect(gasStationDocument).toBeDefined();
			expect(regularDocument.id).toBeDefined();
			expect(gasStationDocument.id).toBeDefined();

			expect(regularDocument.id).not.toBe(gasStationDocument.id);
		}, 60000);
	});

	describe("Document Update Operations with Gas Station", () => {
		let testDocument: any;
		let testDocumentId: string;

		test("Should create a test document for update operations", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			testDocument = await connector.createDocument(TEST_IDENTITY_ID);
			testDocumentId = testDocument.id;

			expect(testDocument).toBeDefined();
			expect(testDocumentId).toBeDefined();
			expect(testDocumentId.includes("did:iota:")).toBe(true);
		}, 30000);

		test("Should add verification method using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			const verificationMethodType = "authentication";
			const verificationMethodId = "gasStationTestVerificationMethod";

			const addedMethod = await connector.addVerificationMethod(
				TEST_IDENTITY_ID,
				testDocumentId,
				verificationMethodType,
				verificationMethodId
			);

			expect(addedMethod).toBeDefined();
			expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);
			expect(addedMethod.type).toEqual("JsonWebKey2020");
		}, 60000);

		test("Should remove verification method using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.removeVerificationMethod(
					TEST_IDENTITY_ID,
					`${testDocumentId}#gasStationTestVerificationMethod`
				)
			).resolves.toBeUndefined();
		}, 30000);

		test("Should add service using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.addService(
					TEST_IDENTITY_ID,
					testDocumentId,
					"testService",
					"LinkedDomains",
					"https://example.com"
				)
			).resolves.toBeDefined();
		}, 30000);

		test("Should remove service using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.removeService(TEST_IDENTITY_ID, `${testDocumentId}#testService`)
			).resolves.toBeUndefined();
		}, 30000);

		test("Should revoke verifiable credentials using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.revokeVerifiableCredentials(TEST_IDENTITY_ID, testDocumentId, [1, 2])
			).resolves.toBeUndefined();
		}, 30000);

		test("Should unrevoke verifiable credentials using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.unrevokeVerifiableCredentials(TEST_IDENTITY_ID, testDocumentId, [1, 2])
			).resolves.toBeUndefined();
		}, 30000);
	});

	describe("Gas Station Error Handling", () => {
		test("Should handle gas station unavailable gracefully", async () => {
			const invalidGasStationConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasStation: {
					gasStationUrl: "http://localhost:9999", // Invalid port
					gasStationAuthToken: GAS_STATION_AUTH_TOKEN
				}
			};

			const connector = new IotaIdentityConnector({
				config: invalidGasStationConfig
			});

			await expect(connector.createDocument(TEST_IDENTITY_ID)).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.createDocumentFailed"
			});
		}, 20000);

		test("Should handle invalid gas station auth token", async () => {
			const invalidAuthConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasStation: {
					gasStationUrl: GAS_STATION_URL,
					gasStationAuthToken: "invalid-token"
				}
			};

			const connector = new IotaIdentityConnector({
				config: invalidAuthConfig
			});

			await expect(connector.createDocument(TEST_IDENTITY_ID)).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.createDocumentFailed"
			});
		}, 20000);

		test("Should handle document update errors with gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			// Test with invalid document ID
			await expect(
				connector.addVerificationMethod(
					TEST_IDENTITY_ID,
					"invalid:document:id",
					DidVerificationMethodType.AssertionMethod,
					"testMethod"
				)
			).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.addVerificationMethodFailed"
			});
		}, 20000);
	});
});

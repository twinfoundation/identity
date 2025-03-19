// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is, Urn } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import {
	DidContexts,
	DidTypes,
	type IDidVerifiableCredential,
	type IProof,
	ProofTypes,
	type DidVerificationMethodType,
	type IDataIntegrityProof,
	type IDidService,
	type IJsonWebSignature2020Proof
} from "@twin.org/standards-w3c-did";
import type { VaultSecret } from "@twin.org/vault-connector-entity-storage";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_IDENTITY_ID,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK
} from "./setupTestEnv";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector";
import { IotaIdentityResolverConnector } from "../src/iotaIdentityResolverConnector";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig";

let testVcJwt: string;
let testDocumentId: string;
let testVerificationMethodId: string;
let identityConnector: IotaIdentityConnector;
let identityResolverConnector: IotaIdentityResolverConnector;
describe("IotaIdentityConnector", () => {
	beforeAll(async () => {
		await setupTestEnv();

		// Create a document and verification method for testing
		try {
			identityConnector = new IotaIdentityConnector({
				config: {
					clientOptions: TEST_CLIENT_OPTIONS,
					vaultMnemonicId: TEST_MNEMONIC_NAME,
					network: TEST_NETWORK
				}
			});

			identityResolverConnector = new IotaIdentityResolverConnector({
				config: {
					clientOptions: TEST_CLIENT_OPTIONS,
					vaultMnemonicId: TEST_MNEMONIC_NAME,
					network: TEST_NETWORK
				}
			});

			// Create a document
			const document = await identityConnector.createDocument(TEST_IDENTITY_ID);
			testDocumentId = document.id;
		} catch (error) {
			console.error("Error in beforeAll:", error);
		}
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

	test("can fail to construct with no config", () => {
		expect(
			() => new IotaIdentityConnector({} as unknown as { config: IIotaIdentityConnectorConfig })
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
				new IotaIdentityConnector({ config: {} } as unknown as {
					config: IIotaIdentityConnectorConfig;
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

	test("can create a document", async () => {
		const testDocument = await identityConnector.createDocument(TEST_IDENTITY_ID);
		testDocumentId = testDocument.id;

		// Check that the document ID starts with did:iota
		expect(testDocument.id.startsWith("did:iota")).toBeTruthy();

		// Ensure the document has the expected structure
		expect(testDocument.id).toBeDefined();
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toEqual(`${testDocument.id}#revocation`);

		const didUrn = Urn.fromValidString(testDocument.id);
		const didParts = didUrn.parts();
		const docAddress = didParts[3];

		console.debug(
			"DID Document",
			`${process.env.TEST_EXPLORER_URL}address/${docAddress}?network=${TEST_NETWORK}`
		);
	});

	test("can fail to resolve a document with no id", async () => {
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
		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);
		expect(resolvedDocument.service).toBeDefined();
		expect((resolvedDocument.service?.[0] as IDidService)?.id).toEqual(
			`${testDocumentId}#revocation`
		);
	});

	test("can fail to add a verification method with no document id", async () => {
		await expect(
			identityConnector.addVerificationMethod(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no document verification method type", async () => {
		await expect(
			identityConnector.addVerificationMethod(
				TEST_IDENTITY_ID,
				"foo",
				undefined as unknown as DidVerificationMethodType,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.arrayOneOf",
			properties: {
				property: "verificationMethodType",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", async () => {
		const verificationMethodType = "authentication";
		const verificationMethodId = "testVerificationMethod";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId,
			verificationMethodType,
			verificationMethodId
		);

		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);
		expect(addedMethod.type).toEqual("JsonWebKey2020");
		testVerificationMethodId = addedMethod.id;

		const keyStore =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultSecret>>(
				"vault-key"
			).getStore();

		expect(keyStore?.[0].id).toEqual(`${TEST_IDENTITY_ID}:${verificationMethodId}`);
	});

	test("can verify verification methods in a resolved document", async () => {
		const documentId = testDocumentId;

		const verificationMethodType = "verificationMethod";
		const verificationMethodId = "testVerificationMethod";

		await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			documentId,
			verificationMethodType,
			verificationMethodId
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(documentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(documentId);

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

	test("can fail to remove a verification method with no verification method id", async () => {
		await expect(
			identityConnector.removeVerificationMethod(TEST_IDENTITY_ID, undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can remove a verification method", async () => {
		const verificationMethodType = "verificationMethod";
		const verificationMethodId = "methodToRemove";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId,
			verificationMethodType,
			verificationMethodId
		);

		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);

		await identityConnector.removeVerificationMethod(
			TEST_IDENTITY_ID,
			`${testDocumentId}#${verificationMethodId}`
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);

		const methodStillExists = resolvedDocument.verificationMethod?.some(method => {
			if (Is.string(method)) {
				return method === `${testDocumentId}#${verificationMethodId}`;
			}
			return method.id === `${testDocumentId}#${verificationMethodId}`;
		});

		expect(methodStillExists).toBeFalsy();
	});

	test("can fail to add a service with no document id", async () => {
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service id", async () => {
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service type", async () => {
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceType",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service endpoint", async () => {
		await expect(
			identityConnector.addService(
				TEST_IDENTITY_ID,
				"foo",
				"foo",
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceEndpoint",
				value: "undefined"
			}
		});
	});

	test("can add a service", async () => {
		const serviceId = "testService";
		const serviceType = "TestServiceType";
		const serviceEndpoint = "https://example.com/service";

		const addedService = await identityConnector.addService(
			TEST_IDENTITY_ID,
			testDocumentId,
			serviceId,
			serviceType,
			serviceEndpoint
		);

		expect(addedService).toBeDefined();
		expect(addedService.id).toEqual(`${testDocumentId}#${serviceId}`);
		expect(addedService.type).toEqual(serviceType);
		expect(addedService.serviceEndpoint).toEqual(serviceEndpoint);
	});

	test("can resolve a document with added service", async () => {
		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);
		expect(resolvedDocument.service).toBeDefined();
		expect(Array.isArray(resolvedDocument.service)).toBeTruthy();

		const addedService = resolvedDocument.service?.find(
			service => service.id === `${testDocumentId}#testService`
		);

		expect(addedService).toBeDefined();
		expect(addedService?.type).toEqual("TestServiceType");
		expect(addedService?.serviceEndpoint).toEqual("https://example.com/service");
	});

	test("can fail to remove a service with no service id", async () => {
		await expect(
			identityConnector.removeService(TEST_IDENTITY_ID, undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can add and remove a service", async () => {
		const documentId = testDocumentId;

		const serviceId = "testServiceToRemove";
		const serviceType = "TestServiceType";
		const serviceEndpoint = "https://example.com/service-to-remove";

		const addedService = await identityConnector.addService(
			TEST_IDENTITY_ID,
			documentId,
			serviceId,
			serviceType,
			serviceEndpoint
		);

		expect(addedService).toBeDefined();
		expect(addedService.id).toEqual(`${documentId}#${serviceId}`);

		await identityConnector.removeService(TEST_IDENTITY_ID, addedService.id);
	});

	test("throws error when removing non-existent service", async () => {
		const nonExistentServiceId = `${testDocumentId}#nonExistentService`;

		await expect(
			identityConnector.removeService(TEST_IDENTITY_ID, nonExistentServiceId)
		).rejects.toThrow(
			expect.objectContaining({
				name: "GeneralError",
				message: "iotaIdentityConnector.removeServiceFailed",
				source: "IotaIdentityConnector",
				inner: expect.objectContaining({
					message: "iotaIdentityConnector.serviceNotFound",
					name: "IOTA"
				})
			})
		);
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				undefined,
				{} as IJsonLdNodeObject,
				undefined
			)
		).rejects.toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.string",
				properties: {
					property: "verificationMethodId",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to create a verifiable credential with no subject", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_IDENTITY_ID,
				"did:iota:test#key-1",
				undefined,
				undefined as unknown as IJsonLdNodeObject,
				undefined
			)
		).rejects.toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "subject",
					value: "undefined"
				}
			})
		);
	});

	test("can create a verifiable credential", async () => {
		const did = testDocumentId;

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			did,
			"assertionMethod",
			"testVerificationMethod"
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod.id).toBeDefined();

		const result = await identityConnector.createVerifiableCredential(
			TEST_IDENTITY_ID,
			verificationMethod.id,
			"https://example.edu/credentials/3732",
			{
				id: did,
				name: "Jane Doe"
			},
			123
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();

		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");

		// Check credential subject
		const credentialSubject = result.verifiableCredential.credentialSubject;
		expect(credentialSubject).toBeDefined();
		if (credentialSubject && !Array.isArray(credentialSubject)) {
			expect(credentialSubject.id).toEqual(did);
			expect(credentialSubject.name).toEqual("Jane Doe");
		}

		expect(result.verifiableCredential.issuer).toEqual(did);
		expect(result.verifiableCredential.issuanceDate).toBeDefined();

		// Check credential status
		if (result.verifiableCredential.credentialStatus) {
			const status = Array.isArray(result.verifiableCredential.credentialStatus)
				? result.verifiableCredential.credentialStatus[0]
				: result.verifiableCredential.credentialStatus;

			expect(status.type).toEqual("RevocationBitmap2022");
			expect(status.revocationBitmapIndex).toEqual("123");
		}

		// Check JWT format
		expect(result.jwt).toBeDefined();
		expect(result.jwt.split(".").length).toEqual(3); // JWT has 3 parts separated by dots

		// Store the JWT for the next test
		testVcJwt = result.jwt;
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		await expect(identityConnector.checkVerifiableCredential("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential", async () => {
		const checkResult = await identityConnector.checkVerifiableCredential(testVcJwt);

		expect(checkResult).toBeDefined();
		expect(checkResult.revoked).toBeFalsy();
		expect(checkResult.verifiableCredential).toBeDefined();

		expect(checkResult.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(checkResult.verifiableCredential?.type).toContain("VerifiableCredential");

		const checkedCredentialSubject = checkResult.verifiableCredential?.credentialSubject;

		expect(checkedCredentialSubject).toBeDefined();
		if (checkedCredentialSubject && !Array.isArray(checkedCredentialSubject)) {
			expect(checkedCredentialSubject.name).toEqual("Jane Doe");
		}

		// Check credential status in the check result
		if (checkResult.verifiableCredential?.credentialStatus) {
			const status = Array.isArray(checkResult.verifiableCredential.credentialStatus)
				? checkResult.verifiableCredential.credentialStatus[0]
				: checkResult.verifiableCredential.credentialStatus;

			expect(status.type).toEqual("RevocationBitmap2022");
			expect(status.revocationBitmapIndex).toEqual("123");
		}
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		await expect(identityConnector.checkVerifiableCredential("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credentialJwt",
				value: ""
			}
		});
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				[123]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to revoke a verifiable credential with no credentialIndices", async () => {
		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				"did:iota:test",
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can unrevoke a verifiable credential", async () => {
		const didId = testDocumentId;

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			didId,
			"assertionMethod",
			"unrevocation-test-key"
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod.id).toBeDefined();

		const revocationIndex = 789;
		const result = await identityConnector.createVerifiableCredential(
			TEST_IDENTITY_ID,
			verificationMethod.id,
			"https://example.edu/credentials/unrevocation-test",
			{
				id: didId,
				name: "Unrevocation Test"
			},
			revocationIndex
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();
		expect(result.jwt).toBeDefined();
		const vcJwt = result.jwt;

		// Check that the credential is not revoked initially
		const initialCheck = await identityConnector.checkVerifiableCredential(vcJwt);
		expect(initialCheck.revoked).toBeFalsy();

		// Perform revocation operation
		await identityConnector.revokeVerifiableCredentials(TEST_IDENTITY_ID, didId, [revocationIndex]);

		// Wait for blockchain to process the operation
		await new Promise(resolve => setTimeout(resolve, 5000));

		// Perform unrevocation operation
		await identityConnector.unrevokeVerifiableCredentials(TEST_IDENTITY_ID, didId, [
			revocationIndex
		]);

		// Wait for blockchain to process the operation
		await new Promise(resolve => setTimeout(resolve, 5000));
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				[123]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to unrevoke a verifiable credential with no credentialIndices", async () => {
		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_IDENTITY_ID,
				"did:iota:test",
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("handles errors when unrevoking a verifiable credential with non-existent document", async () => {
		// Use a non-existent document ID
		const nonExistentDocumentId =
			"did:iota:e678123a:0x0000000000000000000000000000000000000000000000000000000000000000";

		// Attempt to unrevoke the credential and expect an error
		await expect(
			identityConnector.unrevokeVerifiableCredentials(TEST_IDENTITY_ID, nonExistentDocumentId, [
				123
			])
		).rejects.toThrow();
	});

	test("can fail to create a verifiable presentation with no verification method id", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				"",
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[testVcJwt],
				14400
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "verificationMethodId",
				value: ""
			}
		});
	});

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				testVerificationMethodId,
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[],
				14400
			)
		).rejects.toMatchObject({
			name: "GuardError",
			properties: {
				property: "verifiableCredentials",
				value: []
			}
		});
	});

	test("can fail to create a verifiable presentation with invalid expiry", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_IDENTITY_ID,
				testVerificationMethodId,
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[testVcJwt],
				"foo" as unknown as number
			)
		).rejects.toHaveProperty("name", "GuardError");
	});

	test("can create a verifiable presentation", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_IDENTITY_ID,
			testVerificationMethodId,
			"http://example.com/12345",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			14400
		);

		expect(result.verifiablePresentation["@context"]).toEqual([
			DidContexts.ContextVCv1,
			"https://www.w3.org/2018/credentials/v1"
		]);
		expect(result.verifiablePresentation.type).toEqual([DidTypes.VerifiablePresentation, "Person"]);
		expect(result.verifiablePresentation.verifiableCredential).toBeDefined();
		expect((result.verifiablePresentation.verifiableCredential as string[])[0]).toEqual(testVcJwt);
		expect(result.verifiablePresentation.holder?.startsWith("did:iota")).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		await expect(identityConnector.checkVerifiablePresentation("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentationJwt",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		const createResult = await identityConnector.createVerifiablePresentation(
			TEST_IDENTITY_ID,
			testVerificationMethodId,
			"http://example.com/12345",
			"https://schema.org",
			["Person"],
			[testVcJwt],
			14400
		);

		const vpJwt = createResult.jwt;
		const result = await identityConnector.checkVerifiablePresentation(vpJwt);

		expect(result.revoked).toBeFalsy();
		expect(result.verifiablePresentation).toBeDefined();
		expect(result.verifiablePresentation?.["@context"]).toBeDefined();
		expect(result.verifiablePresentation?.type).toBeDefined();
		expect(result.verifiablePresentation?.verifiableCredential).toBeDefined();
		expect(result.verifiablePresentation?.holder).toBeDefined();
		expect(result.issuers).toBeDefined();
		expect(result.issuers?.length).toBeGreaterThan(0);
	});

	it("should create a proof for a document", async () => {
		const testDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:example:123456789abcdefghi",
			name: "Test Document",
			description: "This is a test document for proof creation and verification"
		};
		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			testDocument
		);

		expect(proof).toBeDefined();
		expect(proof.type).toBe(ProofTypes.DataIntegrityProof);
		expect(proof.verificationMethod).toBe(testVerificationMethodId);
		expect(proof.proofPurpose).toBe("assertionMethod");
		expect(proof.created).toBeDefined();

		// Check for signature based on proof type
		if (proof.type === ProofTypes.JsonWebSignature2020) {
			// For JsonWebSignature2020, we expect a jws property
			expect((proof as IJsonWebSignature2020Proof).jws).toBeDefined();
		} else if (proof.type === ProofTypes.DataIntegrityProof) {
			// For DataIntegrityProof, we expect a proofValue property
			expect((proof as IDataIntegrityProof).proofValue).toBeDefined();
		}
	});

	test("can fail to create a proof with no verificationMethodId", async () => {
		await expect(
			identityConnector.createProof(
				TEST_IDENTITY_ID,
				undefined as unknown as string,
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no document", async () => {
		await expect(
			identityConnector.createProof(
				TEST_IDENTITY_ID,
				"foo",
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "unsecureDocument",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no bytes", async () => {
		await expect(
			identityConnector.verifyProof(
				undefined as unknown as IJsonLdNodeObject,
				undefined as unknown as IProof
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "document",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no proof", async () => {
		await expect(
			identityConnector.verifyProof({}, undefined as unknown as IProof)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "proof",
				value: "undefined"
			}
		});
	});

	it("should verify a valid proof", async () => {
		const verificationMethodType = "assertionMethod";
		const verificationMethodId = "proofTestMethod";

		const document = await identityConnector.createDocument(TEST_IDENTITY_ID);
		const testDocumentId2 = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			testDocumentId2,
			verificationMethodType,
			verificationMethodId
		);

		expect(method).toBeDefined();
		expect(method.id).toBeDefined();

		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			method.id,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const isValid = await identityConnector.verifyProof(unsecuredDocument, proof);
		expect(isValid).toBeTruthy();
	});

	it("should fail to verify a tampered document", async () => {
		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const tamperedDocument = { ...unsecuredDocument };
		tamperedDocument.name = "Tampered Document";

		const isValid = await identityConnector.verifyProof(tamperedDocument, proof);
		expect(isValid).toBeFalsy();
	});

	it("should fail to verify a tampered proof", async () => {
		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/ns/credentials/v2",
				"https://www.w3.org/ns/credentials/examples/v2"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const tamperedProof = { ...proof };
		if (tamperedProof.type === "JsonWebSignature2020") {
			(tamperedProof as IJsonWebSignature2020Proof).jws += "tampered";
		} else if (tamperedProof.type === "DataIntegrityProof") {
			(tamperedProof as IDataIntegrityProof).proofValue += "tampered";
		}

		const isValid = await identityConnector.verifyProof(unsecuredDocument, tamperedProof);
		expect(isValid).toBeFalsy();
	});

	test("can handle methods without a controller", async () => {
		const connectorWithoutController = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		expect(testVcJwt).toBeDefined();

		const checkResult = await connectorWithoutController.checkVerifiableCredential(testVcJwt);

		expect(checkResult).toBeDefined();
		expect(checkResult.revoked).toBeFalsy();
		expect(checkResult.verifiableCredential).toBeDefined();
	});
});

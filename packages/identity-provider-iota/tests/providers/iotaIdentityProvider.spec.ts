// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { Converter } from "@gtsc/core";
import { Bip39, Bip44, KeyType } from "@gtsc/crypto";
import type { IDidDocumentVerificationMethod, IDidService } from "@gtsc/identity-provider-models";
import type { IIotaIdentityProviderConfig } from "../../src/models/IIotaIdentityProviderConfig";
import { IotaIdentityProvider } from "../../src/providers/iotaIdentityProvider";
import {
	TEST_BECH32_HRP,
	TEST_CLIENT_OPTIONS,
	TEST_COIN_TYPE,
	TEST_EXPLORER_SEARCH,
	TEST_MNEMONIC,
	TEST_WALLET_KEY_PAIR,
	initTestWallet
} from "../testWallet";

const TEST_IDENTITY_ADDRESS_INDEX = 500000;
let testDocumentId: string;
let testVerificationId: string;

describe("IotaIdentityProvider", () => {
	beforeAll(async () => {
		await initTestWallet();
	});

	test("can fail to construct with no config", () => {
		expect(
			() => new IotaIdentityProvider(undefined as unknown as IIotaIdentityProviderConfig)
		).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "config",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to construct with no config.clientOptions", () => {
		expect(() => new IotaIdentityProvider({} as IIotaIdentityProviderConfig)).toThrow(
			expect.objectContaining({
				name: "GuardError",
				message: "guard.objectUndefined",
				properties: {
					property: "config.clientOptions",
					value: "undefined"
				}
			})
		);
	});

	test("can fail to create a document with no document private key ", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument(
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no public key ", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument(new Uint8Array(), undefined as unknown as Uint8Array)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPublicKey",
				value: "undefined"
			}
		});
	});

	test("can create a document", { timeout: 120000 }, async () => {
		const identityProvider = new IotaIdentityProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			addressIndex: TEST_IDENTITY_ADDRESS_INDEX
		});

		const doc = await identityProvider.createDocument(
			TEST_WALLET_KEY_PAIR.privateKey,
			TEST_WALLET_KEY_PAIR.publicKey
		);
		testDocumentId = doc.id;
		expect(doc.id.slice(0, 15)).toBe(`did:iota:${TEST_BECH32_HRP}:0x`);
		console.log("DID Document", `${TEST_EXPLORER_SEARCH}${doc.id.slice(15)}`);
		expect(doc.verificationMethod).toBeDefined();
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);

		const verificationMethod = (doc.verificationMethod as IDidDocumentVerificationMethod[])?.find(
			v => v.publicKeyJwk?.x === Converter.bytesToBase64(TEST_WALLET_KEY_PAIR.publicKey)
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toBe(`${doc.id}#${verificationMethod?.publicKeyJwk?.kid}`);
		// documentId = `did:iota:${TEST_BECH32_HRP}:0xa689b6194a3fed279eb18c5b1caab9f13ef8eeab0f1e908f51c1cf32f976f572`;
		// console.log("DID Document", `${TEST_EXPLORER_SEARCH}${documentId.slice(15)}`);
	});

	test("can fail to resolve a document with no id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.resolveDocument(undefined as unknown as string)
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
		const identityProvider = new IotaIdentityProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			addressIndex: TEST_IDENTITY_ADDRESS_INDEX
		});

		const doc = await identityProvider.resolveDocument(testDocumentId);
		expect(doc.id.slice(0, 15)).toBe(`did:iota:${TEST_BECH32_HRP}:0x`);
		expect(doc.verificationMethod).toBeDefined();
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
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

	test("can fail to add a verification method with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no verification public key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethod(
				"foo",
				new Uint8Array(),
				undefined as unknown as Uint8Array
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "verificationPublicKey",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", { timeout: 120000 }, async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
		const verificationKeyPair = Bip44.addressBech32(
			seed,
			KeyType.Ed25519,
			TEST_BECH32_HRP,
			TEST_COIN_TYPE,
			1000,
			false,
			0
		);
		const doc = await identityProvider.addVerificationMethod(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			verificationKeyPair.keyPair.publicKey
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.verificationMethod).toBeDefined();

		const verificationMethod = (doc.verificationMethod as IDidDocumentVerificationMethod[])?.find(
			v => v.publicKeyJwk?.x === Converter.bytesToBase64(verificationKeyPair.keyPair.publicKey)
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod?.id).toBe(`${doc.id}#${verificationMethod?.publicKeyJwk?.kid}`);

		testVerificationId = verificationMethod?.id ?? "";
	});

	test("can fail to remove a verification method with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				undefined as unknown as string,
				undefined as unknown as Uint8Array,
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

	test("can fail to remove a verification method with no document private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				"foo",
				undefined as unknown as Uint8Array,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.uint8Array",
			properties: {
				property: "documentPrivateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.removeVerificationMethod(
				"foo",
				new Uint8Array(),
				undefined as unknown as string
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

	test("can remove a verification method", { timeout: 120000 }, async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });

		const doc = await identityProvider.removeVerificationMethod(
			testDocumentId,
			TEST_WALLET_KEY_PAIR.privateKey,
			testVerificationId
		);

		expect(doc.id).toBe(testDocumentId);
		expect(doc.verificationMethod).toBeDefined();

		const verificationMethod = (doc.verificationMethod as IDidDocumentVerificationMethod[])?.find(
			v => v.id === testVerificationId
		);
		expect(verificationMethod).toBeUndefined();
	});
});

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { Converter } from "@gtsc/core";
import {
	KeyPairHelper,
	KeyType,
	type IDidService,
	type IKeyPair
} from "@gtsc/identity-provider-models";
import type { IIotaIdentityProviderConfig } from "../../src/models/IIotaIdentityProviderConfig";
import { IotaIdentityProvider } from "../../src/providers/iotaIdentityProvider";
import {
	TEST_BECH32_HRP,
	TEST_CLIENT_OPTIONS,
	TEST_EXPLORER_SEARCH,
	TEST_MNEMONIC,
	TEST_WALLET_KEY_PAIR,
	initTestWallet
} from "../testWallet";

const TEST_IDENTITY_ADDRESS_INDEX = 500000;
let documentId: string;

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

	test("can fail to create a document with no key pair", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument(undefined as unknown as IKeyPair)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "documentKeyPair",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no key pair type", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(identityProvider.createDocument({} as unknown as IKeyPair)).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.type",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument({ type: KeyType.Ed25519 } as unknown as IKeyPair)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.privateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument({ type: KeyType.Ed25519 } as unknown as IKeyPair)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.privateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to create a document with no public key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.createDocument({
				type: KeyType.Ed25519,
				privateKey: "foo"
			} as unknown as IKeyPair)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.publicKey",
				value: "undefined"
			}
		});
	});

	test("can create a document", { timeout: 60000 }, async () => {
		const identityProvider = new IotaIdentityProvider({
			clientOptions: TEST_CLIENT_OPTIONS,
			addressIndex: TEST_IDENTITY_ADDRESS_INDEX
		});

		const doc = await identityProvider.createDocument({
			type: KeyType.Ed25519,
			privateKey: Converter.bytesToHex(TEST_WALLET_KEY_PAIR.privateKey, true),
			publicKey: Converter.bytesToHex(TEST_WALLET_KEY_PAIR.publicKey, true)
		});
		documentId = doc.id;
		expect(doc.id.slice(0, 15)).toBe(`did:iota:${TEST_BECH32_HRP}:0x`);
		console.log("DID Document", `${TEST_EXPLORER_SEARCH}${doc.id.slice(15)}`);
		expect(doc.verificationMethod).toBeDefined();
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);
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

		const doc = await identityProvider.resolveDocument(documentId);
		expect(doc.id.slice(0, 15)).toBe(`did:iota:${TEST_BECH32_HRP}:0x`);
		expect(doc.verificationMethod).toBeDefined();
		expect(doc.service).toBeDefined();
		expect((doc.service?.[0] as IDidService)?.id).toBe(`${doc.id}#revocation`);
	});

	test("can fail to add a verification method with no document id", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				undefined as unknown as string,
				undefined as unknown as IKeyPair,
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

	test("can fail to add a verification method with no document key pair", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				"foo",
				undefined as unknown as IKeyPair,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "documentKeyPair",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no document key pair type", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				"foo",
				{} as unknown as IKeyPair,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.type",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no document key pair private key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				"foo",
				{
					type: KeyType.Ed25519
				} as unknown as IKeyPair,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.privateKey",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no document key pair public key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				"foo",
				{
					type: KeyType.Ed25519,
					privateKey: "foo"
				} as unknown as IKeyPair,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentKeyPair.publicKey",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no verification public key", async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		await expect(
			identityProvider.addVerificationMethodJwk(
				"foo",
				{
					type: KeyType.Ed25519,
					privateKey: "foo",
					publicKey: "foo"
				},
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationPublicKey",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", { timeout: 60000 }, async () => {
		const identityProvider = new IotaIdentityProvider({ clientOptions: TEST_CLIENT_OPTIONS });
		const verificationKeyPair = KeyPairHelper.subKeyPair(
			KeyPairHelper.fromMnemonic(KeyType.Ed25519, TEST_MNEMONIC),
			KeyPairHelper.nameToPath("my-key")
		);
		const doc = await identityProvider.addVerificationMethodJwk(
			documentId,
			{
				type: KeyType.Ed25519,
				privateKey: Converter.bytesToHex(TEST_WALLET_KEY_PAIR.privateKey, true),
				publicKey: Converter.bytesToHex(TEST_WALLET_KEY_PAIR.publicKey, true)
			},
			verificationKeyPair.publicKey
		);

		expect(doc.id).toBe(documentId);
		expect(doc.verificationMethod).toBeDefined();
	});
});

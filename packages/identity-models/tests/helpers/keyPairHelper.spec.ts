// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { KeyPairHelper } from "../../src/helpers/keyPairHelper";
import { KeyType } from "../../src/models/keyType";

describe("KeyPairHelper", () => {
	test("Can generate a key pair and mnemonic", () => {
		const keyPair = KeyPairHelper.keyPair(KeyType.Ed25519);
		expect(keyPair.mnemonic.split(" ").length).toEqual(24);
		expect(keyPair.keyPair.type).toEqual("ed25519");
		expect(keyPair.keyPair.publicKey.length).toBeGreaterThan(0);
		expect(keyPair.keyPair.privateKey.length).toBeGreaterThan(0);
	});

	test("Can generate a key pair from a mnemonic", () => {
		const expectedKeyPair = {
			type: "ed25519",
			publicKey: "f4e41c18ffe46291044d67d4721d55e905c46ecd79220aa440493eacc4e72041",
			privateKey: "a96aff95f3baefd123d8af64c1305cd8b978d8d255dab68e3f57bafc2afaa8bf"
		};

		const keyPair = KeyPairHelper.fromMnemonic(
			KeyType.Ed25519,
			"nut easy split result cabin arrive manage leader pull adult urge pave pause lemon swear wedding hybrid elbow cloth mail purity empower main wood"
		);

		expect(keyPair).toEqual(expectedKeyPair);
	});

	test("Can generate a sub key pair", () => {
		const expectedSubKeyPair = {
			type: "ed25519",
			publicKey: "388e1c5d6b82ea11f7fa867face2464adc0506b7ea7c303f9fcdcb7c539ff531",
			privateKey: "2901c3df8bfbdbe473756e630dae41249a847e8ba326bc32e9c9065e2e8cec87"
		};

		const keyPair = KeyPairHelper.fromMnemonic(
			KeyType.Ed25519,
			"nut easy split result cabin arrive manage leader pull adult urge pave pause lemon swear wedding hybrid elbow cloth mail purity empower main wood"
		);
		const path = KeyPairHelper.nameToPath("test");
		const subKeyPair = KeyPairHelper.subKeyPair(keyPair, path);

		expect(subKeyPair).toEqual(expectedSubKeyPair);
	});

	test("Can generate multiple sub key pairs", () => {
		const expectedSubKeyPairs = [
			{
				type: "ed25519",
				publicKey: "958436b5404b14fdcd6303f6af2aa30bf5d5a511583d916341f7791a02367e3d",
				privateKey: "4f49275c55b6c3ab8ffb0b0506f1dd3aed7c44717a958ebebc8170c76f96d98c"
			},
			{
				type: "ed25519",
				publicKey: "9dda7808352823e3db4fbe513a6ebed872b0f75f23682a319e23a8b82df86d50",
				privateKey: "a4e3dfc699bdb993ce0345f4e7238edb6219714b2449252e87c6d1679a5a5f36"
			},
			{
				type: "ed25519",
				publicKey: "354f10362979402722704d45c2d42313b5bfc9c13c8cc2426cb1f896b48d841b",
				privateKey: "ac3560bb5163e9d8fd9e67052cee7bbbf3fbdf8c76e03acad475858f4b40b057"
			},
			{
				type: "ed25519",
				publicKey: "a98fd6648d68493e831f9c7e1951e470ed1f1f8af92d4ac304eb1f058c04e5a5",
				privateKey: "cbf5670d2ea9c60c51c2e23a59b6fb32b1f8be1e67665e6b30a5ac5092c1878c"
			}
		];

		const keyPair = KeyPairHelper.fromMnemonic(
			KeyType.Ed25519,
			"nut easy split result cabin arrive manage leader pull adult urge pave pause lemon swear wedding hybrid elbow cloth mail purity empower main wood"
		);
		const pathRoot = KeyPairHelper.nameToPath("test");
		const subKeyPairs = KeyPairHelper.subKeyPairs(keyPair, pathRoot, 0, 4);

		expect(subKeyPairs.length).toEqual(expectedSubKeyPairs.length);
		for (let i = 0; i < subKeyPairs.length; i++) {
			const subKeyPair = subKeyPairs[i];
			const expectedSubKeyPair = expectedSubKeyPairs[i];
			expect(subKeyPair).toEqual(expectedSubKeyPair);
		}
	});
});

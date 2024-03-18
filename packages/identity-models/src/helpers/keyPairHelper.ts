// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, Guards } from "@gtsc/core";
import { Blake2b, Bip39, Ed25519, Bip32Path, Slip0010 } from "@gtsc/crypto";
import { nameof } from "@gtsc/nameof";
import type { IKeyPair } from "../models/IKeyPair";
import { KeyType } from "../models/keyType";

/**
 * Class for helping with key pair creation.
 */
export class KeyPairHelper {
	/**
	 * Runtime name for the class.
	 * @internal
	 */
	private static readonly _CLASS_NAME: string = nameof<KeyPairHelper>();

	/**
	 * Generate a new key pair.
	 * @param type The key type to generate.
	 * @returns The new key pair.
	 */
	public static keyPair(type: KeyType): {
		/**
		 * The mnemonic for recovering the key.
		 */
		mnemonic: string;

		/**
		 * The key pair that was generated.
		 */
		keyPair: IKeyPair;
	} {
		Guards.arrayOneOf(KeyPairHelper._CLASS_NAME, nameof(type), type, Object.values(KeyType));

		const mnemonic = Bip39.randomMnemonic();

		return {
			mnemonic,
			keyPair: KeyPairHelper.fromMnemonic(type, mnemonic)
		};
	}

	/**
	 * Generate a new key pair.
	 * @param type The key type to generate.
	 * @param mnemonic The mnemonic to use for key generation.
	 * @returns The new key pair.
	 */
	public static fromMnemonic(type: KeyType, mnemonic: string): IKeyPair {
		Guards.arrayOneOf(KeyPairHelper._CLASS_NAME, nameof(type), type, Object.values(KeyType));

		const secretKey = Bip39.mnemonicToSeed(mnemonic);
		const signKeyPair = Ed25519.keyPairFromSeed(secretKey);

		return {
			type,
			publicKey: Converter.bytesToHex(signKeyPair.publicKey),
			privateKey: Converter.bytesToHex(signKeyPair.privateKey).slice(0, 64)
		};
	}

	/**
	 * Generate a sub key pair by index.
	 * @param keyPair The root key pair.
	 * @param path The sub key path to generate in Bip32 format eg m/0/1/2/3 .
	 * @returns The sub key pair.
	 */
	public static subKeyPair(keyPair: IKeyPair, path: string): IKeyPair {
		Guards.object<IKeyPair>(KeyPairHelper._CLASS_NAME, nameof(keyPair), keyPair);
		Guards.stringValue(KeyPairHelper._CLASS_NAME, nameof(path), path);

		const subKey = Slip0010.derivePath(
			Converter.hexToBytes(keyPair.privateKey),
			new Bip32Path(path)
		);

		const subKeyPair = Ed25519.keyPairFromSeed(subKey.privateKey);

		return {
			type: keyPair.type,
			publicKey: Converter.bytesToHex(subKeyPair.publicKey),
			privateKey: Converter.bytesToHex(subKeyPair.privateKey).slice(0, 64)
		};
	}

	/**
	 * Generate a sub key pair list.
	 * @param keyPair The root key pair.
	 * @param pathRoot The sub key path root to generate in Bip32 format eg m/0/1/2/3 .
	 * @param start The start index of the sub key to generate.
	 * @param count The number of sub keys to generate.
	 * @returns The sub key pair list.
	 */
	public static subKeyPairs(
		keyPair: IKeyPair,
		pathRoot: string,
		start: number,
		count: number
	): IKeyPair[] {
		Guards.object<IKeyPair>(KeyPairHelper._CLASS_NAME, nameof(keyPair), keyPair);
		Guards.stringValue(KeyPairHelper._CLASS_NAME, nameof(pathRoot), pathRoot);
		Guards.number(KeyPairHelper._CLASS_NAME, nameof(start), start);
		Guards.number(KeyPairHelper._CLASS_NAME, nameof(count), count);

		const keyPairs: IKeyPair[] = [];
		const path = new Bip32Path(pathRoot);

		for (let i = start; i < start + count; i++) {
			path.push(i);
			keyPairs.push(KeyPairHelper.subKeyPair(keyPair, path.toString()));
			path.pop();
		}

		return keyPairs;
	}

	/**
	 * Convert a text name to a Bip32 path.
	 * @param name The name to convert to a path.
	 * @returns The path.
	 */
	public static nameToPath(name: string): string {
		Guards.stringValue(KeyPairHelper._CLASS_NAME, nameof(name), name);

		const bytes = Blake2b.sum256(Converter.utf8ToBytes(name));

		const path: string[] = Array.from(bytes).map(b => b.toString());

		path.unshift("m");

		return path.join("/");
	}
}

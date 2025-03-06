// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import { DocumentHelper } from "../../src/utils/documentHelper";

describe("DocumentHelper", () => {
	test("Can fail when a document has no verification method", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21"
		};

		expect(() =>
			DocumentHelper.getVerificationMethod(
				document,
				"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4"
			)
		).toThrowError("documentHelper.verificationMethodNotFound");
	});

	test("Can fail when a document has no matching verification method", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			verificationMethod: [
				{
					id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
					controller:
						"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
					type: "JsonWebKey2020",
					publicKeyJwk: {
						kty: "OKP",
						use: "sig",
						alg: "EdDSA",
						x5u: "https://tinyurl.com/5yneutbk",
						crv: "Ed25519",
						x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
					}
				}
			]
		};

		expect(() =>
			DocumentHelper.getVerificationMethod(
				document,
				"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#1111"
			)
		).toThrowError("documentHelper.verificationMethodNotFound");
	});

	test("Can succeed when a document has a matching verification method", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			verificationMethod: [
				{
					id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
					controller:
						"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
					type: "JsonWebKey2020",
					publicKeyJwk: {
						kty: "OKP",
						use: "sig",
						alg: "EdDSA",
						x5u: "https://tinyurl.com/5yneutbk",
						crv: "Ed25519",
						x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
					}
				}
			]
		};

		const vm = DocumentHelper.getVerificationMethod(
			document,
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4"
		);
		expect(vm).toEqual({
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
			controller:
				"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			type: "JsonWebKey2020",
			publicKeyJwk: {
				kty: "OKP",
				use: "sig",
				alg: "EdDSA",
				x5u: "https://tinyurl.com/5yneutbk",
				crv: "Ed25519",
				x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
			}
		});
	});

	test("Can succeed when a document has a matching verification method of non default type", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			assertionMethod: [
				{
					id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
					controller:
						"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
					type: "JsonWebKey2020",
					publicKeyJwk: {
						kty: "OKP",
						use: "sig",
						alg: "EdDSA",
						x5u: "https://tinyurl.com/5yneutbk",
						crv: "Ed25519",
						x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
					}
				}
			]
		};

		const vm = DocumentHelper.getVerificationMethod(
			document,
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
			"assertionMethod"
		);
		expect(vm).toEqual({
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
			controller:
				"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			type: "JsonWebKey2020",
			publicKeyJwk: {
				kty: "OKP",
				use: "sig",
				alg: "EdDSA",
				x5u: "https://tinyurl.com/5yneutbk",
				crv: "Ed25519",
				x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
			}
		});
	});

	test("Can fail when a document has a matching verification method but no publicKeyJwk", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			verificationMethod: [
				{
					id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
					controller:
						"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
					type: "JsonWebKey2020"
				}
			]
		};

		expect(() =>
			DocumentHelper.getJwk(
				document,
				"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4"
			)
		).toThrowError("documentHelper.verificationMethodJwkNotFound");
	});

	test("Can succeed when a document has a matching verification method and includes a publicKeyJwk", () => {
		const document: IDidDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
			verificationMethod: [
				{
					id: "did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4",
					controller:
						"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21",
					type: "JsonWebKey2020",
					publicKeyJwk: {
						kty: "OKP",
						use: "sig",
						alg: "EdDSA",
						x5u: "https://tinyurl.com/5yneutbk",
						crv: "Ed25519",
						x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
					}
				}
			]
		};

		const vm = DocumentHelper.getJwk(
			document,
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21#uXzLJyKfcEUGu2_Si6npNukkt3bnxyZk7ViLAca3LO4"
		);
		expect(vm).toEqual({
			kty: "OKP",
			use: "sig",
			alg: "EdDSA",
			x5u: "https://tinyurl.com/5yneutbk",
			crv: "Ed25519",
			x: "qjTxYOYLHNzOj4vlxrIxzaDjDt2Ag-3AUOLLlWJKzVs"
		});
	});
});

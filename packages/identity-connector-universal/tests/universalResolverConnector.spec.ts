// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { UniversalResolverConnector } from "../src/universalResolverConnector";

describe("UniversalResolverConnector", () => {
	test("can construct and resolve an identity", async () => {
		const resolver = new UniversalResolverConnector({
			config: { endpoint: "http://localhost:8080" }
		});

		// We will need to create an identity to check for once the iota connector is ready
		const document = await resolver.resolveDocument(
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21"
		);
		expect(document.id).toEqual(
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21"
		);
	});
});

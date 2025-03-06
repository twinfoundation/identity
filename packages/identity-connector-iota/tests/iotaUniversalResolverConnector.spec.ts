// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupTestEnv } from "./setupTestEnv";
import { IotaUniversalResolverConnector } from "../src/iotaUniversalResolverConnector";

describe("IotaUniversalResolverConnector", () => {
	beforeAll(async () => {
		await setupTestEnv();
	});

	test("can construct and resolve an identity", async () => {
		const resolver = new IotaUniversalResolverConnector({
			config: { endpoint: "http://localhost:8080" }
		});

		// We will need to create an identity to check for once the IOTA rebased connector is ready
		const document = await resolver.resolveDocument(
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21"
		);
		expect(document.id).toEqual(
			"did:iota:testnet:0x119adb64d01d3b0fa0d308c67db90ab1c6e0df6aebe5b7e0250783f57cd10c21"
		);
	});
});

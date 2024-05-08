// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IdentityClient } from "../src/identityClient";

describe("IdentityClient", () => {
	test("Can create an instance", async () => {
		const client = new IdentityClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});

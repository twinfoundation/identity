// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { IdentityProviderFactory } from "../src/factories/identityProviderFactory";
import type { IIdentityProvider } from "../src/models/IIdentityProvider";

describe("IdentityProviderFactory", () => {
	test("can add an item to the factory", async () => {
		IdentityProviderFactory.register("my-identity", () => ({}) as unknown as IIdentityProvider);
	});
});

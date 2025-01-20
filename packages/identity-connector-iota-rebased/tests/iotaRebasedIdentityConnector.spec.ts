// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { setupTestEnv } from "./setupTestEnv";
import { IotaRebasedIdentityConnector } from "../src/IotaRebasedIdentityConnector";
import type { IIotaRebasedIdentityConnectorConfig } from "../src/models/IIotaRebasedIdentityConnectorConfig";

describe("IotaRebasedIdentityConnector", () => {
	beforeAll(async () => {
		await setupTestEnv();
	});

	test("can fail to construct with no options", () => {
		expect(
			() =>
				new IotaRebasedIdentityConnector(
					undefined as unknown as { config: IIotaRebasedIdentityConnectorConfig }
				)
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
});

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { CLIDisplay } from "@gtsc/cli-core";
import { CLI } from "../src/cli";

let writeBuffer: string[] = [];
let errorBuffer: string[] = [];
const localesDirectory = "./dist/locales/";

describe("CLI", () => {
	beforeEach(() => {
		writeBuffer = [];
		errorBuffer = [];

		CLIDisplay.write = (buffer: string | Uint8Array): void => {
			writeBuffer.push(...buffer.toString().split("\n"));
		};

		CLIDisplay.writeError = (buffer: string | Uint8Array): void => {
			errorBuffer.push(...buffer.toString().split("\n"));
		};
	});

	test("Can execute with no command line options and receive help", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["", path.join(__dirname, "identity-cli")], localesDirectory);
		expect(exitCode).toBe(0);
	});
});

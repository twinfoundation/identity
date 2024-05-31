// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Converter } from "@gtsc/core";
import { Bip39 } from "@gtsc/crypto";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Add the mnemonic commands to the CLI.
 * @returns The command.
 */
export function buildCommandMnemonic(): Command {
	const command = new Command();
	command
		.name("mnemonic")
		.summary("Create a 24 word mnemonic.")
		.description(
			"Create a 24 word mnemonic, will also display the equivalent seed in hex and base64 format."
		)
		.option(
			"--json <filename>",
			"Will generate a JSON file with the specified containing the mnemonic and seeds"
		)
		.option(
			"--hideOutput",
			"Hides the output of the mnemonic and seed, useful when only generating the JSON file."
		)
		.action(async opts => {
			const mnemonic = Bip39.randomMnemonic();
			const seed = Bip39.mnemonicToSeed(mnemonic);

			if (!opts.hideOutput) {
				console.log(chalk.green("Mnemonic:"), mnemonic);
				console.log(chalk.green("Seed Hex:"), Converter.bytesToHex(seed, true));
				console.log(chalk.green("Seed Base64:"), Converter.bytesToBase64(seed));
				console.log();
			}

			if (opts?.json) {
				const filename = path.resolve(opts.json);
				console.log(chalk.cyan("Writing JSON file:"), filename);
				console.log();
				await writeFile(
					filename,
					JSON.stringify(
						{
							mnemonic,
							seedHex: Converter.bytesToHex(seed, true),
							seedBase64: Converter.bytesToBase64(seed)
						},
						undefined,
						"\t"
					)
				);
			}
		});
	return command;
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import chalk from "chalk";
import { Command } from "commander";
import { buildCommandMnemonic as mnemonicCommand } from "./commands/mnemonic";

const CLI_ICON = "🌍";
const CLI_TITLE = "GTSC Identity";
const CLI_NAME = "gtsc-identity";
const CLI_VERSION = "0.0.3-next.10";

/**
 * The main entry point for the CLI.
 */
export class CLI {
	/**
	 * Run the app.
	 * @param argv The process arguments.
	 * @returns The exit code.
	 */
	public async run(argv: string[]): Promise<number> {
		return this.execute(
			{
				appName: CLI_NAME,
				title: CLI_TITLE,
				version: CLI_VERSION,
				icon: CLI_ICON
			},
			argv
		);
	}

	/**
	 * Execute the command line processing.
	 * @param options The options for the CLI.
	 * @param options.title The title of the CLI.
	 * @param options.appName The name of the app.
	 * @param options.version The version of the app.
	 * @param options.icon The icon for the CLI.
	 * @param argv The process arguments.
	 * @returns The exit code.
	 */
	public async execute(
		options: {
			title: string;
			appName: string;
			version: string;
			icon: string;
		},
		argv: string[]
	): Promise<number> {
		return new Promise<number>(resolve => {
			try {
				if (!argv.includes("--version") && !argv.includes("-v")) {
					const title = `${options.title} v${options.version}`;
					console.log(`${options.icon} ${chalk.underline.blue(title)}`);
					console.log("");
				}

				const program = new Command();

				program
					.name(options.appName)
					.version(options.version)
					.usage("[command]")
					.showHelpAfterError()
					.configureOutput({
						outputError: (str, write) => write(chalk.red(str))
					})
					.exitOverride(err => {
						// By default commander still calls process.exit on exit
						// which we don't want as we might have subsequent
						// processing to handle, so instead we throw the exit code
						// as a way to skip the process.exit call.
						// If the error code is commander.help then we return 0 as
						// we don't want displaying help to be an error.
						// eslint-disable-next-line no-restricted-syntax
						throw new Error(err.code === "commander.help" ? "0" : err.exitCode.toString());
					});

				program.addCommand(mnemonicCommand());

				program.parse(argv);
			} catch (err) {
				if (err instanceof Error) {
					// This error is the the exit code we errored with
					// from the exitOverride so parse and resolve with it
					resolve(Number.parseInt(err.message, 10));
				} else {
					console.error(chalk.red(err));
					resolve(1);
				}
			}
		});
	}
}

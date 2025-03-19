// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIBase } from "@twin.org/cli-core";
import { buildCommandAddress, buildCommandMnemonic } from "@twin.org/crypto-cli";
import { buildCommandFaucet, buildCommandTransfer } from "@twin.org/wallet-cli";
import type { Command } from "commander";
import { buildCommandIdentityCreate } from "./commands/identityCreate";
import { buildCommandIdentityResolve } from "./commands/identityResolve";
import { buildCommandProofCreate } from "./commands/proofCreate";
import { buildCommandProofVerify } from "./commands/proofVerify";
import { buildCommandServiceAdd } from "./commands/serviceAdd";
import { buildCommandServiceRemove } from "./commands/serviceRemove";
import { buildCommandVerifiableCredentialCreate } from "./commands/verifiableCredentialCreate";
import { buildCommandVerifiableCredentialRevoke } from "./commands/verifiableCredentialRevoke";
import { buildCommandVerifiableCredentialUnrevoke } from "./commands/verifiableCredentialUnrevoke";
import { buildCommandVerifiableCredentialVerify } from "./commands/verifiableCredentialVerify";
import { buildCommandVerificationMethodAdd } from "./commands/verificationMethodAdd";
import { buildCommandVerificationMethodRemove } from "./commands/verificationMethodRemove";

/**
 * The main entry point for the CLI.
 */
export class CLI extends CLIBase {
	/**
	 * Run the app.
	 * @param argv The process arguments.
	 * @param localesDirectory The directory for the locales, default to relative to the script.
	 * @param options Additional options for the CLI.
	 * @param options.overrideOutputWidth The override output width.
	 * @returns The exit code.
	 */
	public async run(
		argv: string[],
		localesDirectory?: string,
		options?: { overrideOutputWidth?: number }
	): Promise<number> {
		return this.execute(
			{
				title: "TWIN Identity",
				appName: "twin-identity",
				version: "0.0.1-next.36",
				icon: "🌍",
				supportsEnvFiles: true,
				overrideOutputWidth: options?.overrideOutputWidth
			},
			localesDirectory ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../locales"),
			argv
		);
	}

	/**
	 * Get the commands for the CLI.
	 * @param program The main program to add the commands to.
	 * @internal
	 */
	protected getCommands(program: Command): Command[] {
		return [
			buildCommandMnemonic(),
			buildCommandAddress(),
			buildCommandFaucet(),
			buildCommandTransfer(),
			buildCommandIdentityCreate(),
			buildCommandIdentityResolve(),
			buildCommandVerificationMethodAdd(),
			buildCommandVerificationMethodRemove(),
			buildCommandServiceAdd(),
			buildCommandServiceRemove(),
			buildCommandVerifiableCredentialCreate(),
			buildCommandVerifiableCredentialVerify(),
			buildCommandVerifiableCredentialRevoke(),
			buildCommandVerifiableCredentialUnrevoke(),
			buildCommandProofCreate(),
			buildCommandProofVerify()
		];
	}
}

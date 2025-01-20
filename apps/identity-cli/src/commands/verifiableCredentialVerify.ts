// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { I18n, Is } from "@twin.org/core";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Build the verifiable credential verify command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiableCredentialVerify(): Command {
	const command = new Command();
	command
		.name("verifiable-credential-verify")
		.summary(I18n.formatMessage("commands.verifiable-credential-verify.summary"))
		.description(I18n.formatMessage("commands.verifiable-credential-verify.description"))
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-verify.options.jwt.param"),
			I18n.formatMessage("commands.verifiable-credential-verify.options.jwt.description")
		);

	CLIOptions.output(command, {
		noConsole: true,
		json: true,
		env: true,
		mergeJson: true,
		mergeEnv: true
	});

	command
		.addOption(
			new Option(
				I18n.formatMessage("commands.common.options.connector.param"),
				I18n.formatMessage("commands.common.options.connector.description")
			)
				.choices(Object.values(IdentityConnectorTypes))
				.default(IdentityConnectorTypes.Iota)
		)
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.option(
			I18n.formatMessage("commands.common.options.network.param"),
			I18n.formatMessage("commands.common.options.network.description"),
			"!NETWORK"
		)
		.action(actionCommandVerifiableCredentialVerify);

	return command;
}

/**
 * Action the verifiable credential verify command.
 * @param opts The options for the command.
 * @param opts.jwt The JSON web token for the verifiable credential.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialVerify(
	opts: {
		jwt: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const jwt: string = CLIParam.stringValue("jwt", opts.jwt);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.IotaRebased
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	CLIDisplay.value(I18n.formatMessage("commands.verifiable-credential-verify.labels.jwt"), jwt);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.break();

	setupVault();

	const walletConnector = setupWalletConnector({ nodeEndpoint, network }, opts.connector);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector({ nodeEndpoint, network }, opts.connector);

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-credential-verify.progress.verifyingCredential")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verification = await identityConnector.checkVerifiableCredential(jwt);

	const isVerified = Is.notEmpty(verification.verifiableCredential);
	const isRevoked = verification.revoked;

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-verify.labels.isVerified"),
			isVerified
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-verify.labels.isRevoked"),
			isRevoked
		);
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, { isVerified, isRevoked }, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_VERIFIABLE_CREDENTIAL_VERIFIED="${isVerified}"`,
				`DID_VERIFIABLE_CREDENTIAL_REVOKED="${isRevoked}"`
			],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}

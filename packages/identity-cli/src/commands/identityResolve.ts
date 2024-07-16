// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils, type CliOutputOptions } from "@gtsc/cli-core";
import { I18n, Is, StringHelper } from "@gtsc/core";
import { IotaIdentityConnector, IotaIdentityUtils } from "@gtsc/identity-connector-iota";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the identity resolve command for the CLI.
 * @returns The command.
 */
export function buildCommandIdentityResolve(): Command {
	const command = new Command();
	command
		.name("identity-resolve")
		.summary(I18n.formatMessage("commands.identity-resolve.summary"))
		.description(I18n.formatMessage("commands.identity-resolve.description"))
		.requiredOption(
			I18n.formatMessage("commands.identity-resolve.options.did.param"),
			I18n.formatMessage("commands.identity-resolve.options.did.description")
		);

	CLIOptions.output(command, {
		noConsole: true,
		json: true,
		env: false,
		mergeJson: true,
		mergeEnv: false
	});

	command
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.option(
			I18n.formatMessage("commands.common.options.explorer.param"),
			I18n.formatMessage("commands.common.options.explorer.description"),
			"!EXPLORER_URL"
		)
		.action(actionCommandIdentityResolve);

	return command;
}

/**
 * Action the identity resolve command.
 * @param opts The options for the command.
 * @param opts.did The identity to resolve.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandIdentityResolve(
	opts: {
		did: string;
		node: string;
		explorer: string;
	} & CliOutputOptions
): Promise<void> {
	const did: string = CLIParam.stringValue("did", opts.did);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const iotaIdentityConnector = new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	});

	CLIDisplay.task(I18n.formatMessage("commands.identity-resolve.progress.resolvingIdentity"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const requestContext = { identity: "local", partitionId: "local" };
	const document = await iotaIdentityConnector.resolveDocument(did, requestContext);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.section(I18n.formatMessage("commands.identity-resolve.labels.didDocument"));

		CLIDisplay.json(document);
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, document, opts.mergeJson);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(document.id)}?tab=DID`
	);
	CLIDisplay.break();

	CLIDisplay.done();
}

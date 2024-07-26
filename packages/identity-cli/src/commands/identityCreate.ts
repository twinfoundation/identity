// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils, type CliOutputOptions } from "@gtsc/cli-core";
import { Converter, I18n, Is, StringHelper } from "@gtsc/core";
import { IotaIdentityConnector, IotaIdentityUtils } from "@gtsc/identity-connector-iota";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the identity create command for the CLI.
 * @returns The command.
 */
export function buildCommandIdentityCreate(): Command {
	const command = new Command();
	command
		.name("identity-create")
		.summary(I18n.formatMessage("commands.identity-create.summary"))
		.description(I18n.formatMessage("commands.identity-create.description"))
		.requiredOption(
			I18n.formatMessage("commands.identity-create.options.seed.param"),
			I18n.formatMessage("commands.identity-create.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.identity-create.options.controller.param"),
			I18n.formatMessage("commands.identity-create.options.controller.description")
		);

	CLIOptions.output(command, {
		noConsole: true,
		json: true,
		env: true,
		mergeJson: true,
		mergeEnv: true
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
		.action(actionCommandIdentityCreate);

	return command;
}

/**
 * Action the identity create command.
 * @param opts The options for the command.
 * @param opts.controller The address to fill from the faucet.
 * @param opts.seed The private key for the controller.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandIdentityCreate(
	opts: {
		controller: string;
		seed: string;
		node: string;
		explorer: string;
	} & CliOutputOptions
): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const controller: string = CLIParam.bech32("controller", opts.controller);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.identity-create.labels.controller"), controller);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const requestContext = { userIdentity: "local", partitionId: "local" };
	const vaultSeedId = "local-seed";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(vaultSeedId, Converter.bytesToBase64(seed), requestContext);

	const iotaIdentityConnector = new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			},
			vaultSeedId
		}
	});

	CLIDisplay.task(I18n.formatMessage("commands.identity-create.progress.creatingIdentity"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const document = await iotaIdentityConnector.createDocument(controller, requestContext);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(I18n.formatMessage("commands.identity-create.labels.identity"), document.id);
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, { did: document.id }, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(opts.env, [`DID="${document.id}"`], opts.mergeEnv);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(document.id)}?tab=DID`
	);
	CLIDisplay.break();

	CLIDisplay.done();
}

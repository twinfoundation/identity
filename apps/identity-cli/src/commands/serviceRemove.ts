// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam } from "@twin.org/cli-core";
import { Converter, I18n, Is, StringHelper } from "@twin.org/core";
import { IotaIdentityUtils } from "@twin.org/identity-connector-iota";
import { DocumentHelper } from "@twin.org/identity-models";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Build the service remove command for the CLI.
 * @returns The command.
 */
export function buildCommandServiceRemove(): Command {
	const command = new Command();
	command
		.name("service-remove")
		.summary(I18n.formatMessage("commands.service-remove.summary"))
		.description(I18n.formatMessage("commands.service-remove.description"))
		.requiredOption(
			I18n.formatMessage("commands.service-remove.options.seed.param"),
			I18n.formatMessage("commands.service-remove.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-remove.options.id.param"),
			I18n.formatMessage("commands.service-remove.options.id.description")
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
		.option(
			I18n.formatMessage("commands.common.options.explorer.param"),
			I18n.formatMessage("commands.common.options.explorer.description"),
			"!EXPLORER_URL"
		)
		.action(actionCommandServiceRemove);

	return command;
}

/**
 * Action the service remove command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.id The id of the service to remove.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for rebased connector.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandServiceRemove(opts: {
	seed: string;
	id: string;
	connector?: IdentityConnectorTypes;
	node: string;
	network?: string;
	explorer: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const id: string = CLIParam.stringValue("id", opts.id);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.IotaRebased
			? CLIParam.stringValue("network", opts.network)
			: undefined;
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.service-remove.labels.serviceId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const vaultSeedId = "local-seed";
	const localIdentity = "local";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(`${localIdentity}/${vaultSeedId}`, Converter.bytesToBase64(seed));

	const walletConnector = setupWalletConnector(
		{ nodeEndpoint, vaultSeedId, network },
		opts.connector
	);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector(
		{ nodeEndpoint, network, vaultSeedId },
		opts.connector
	);

	CLIDisplay.task(I18n.formatMessage("commands.service-remove.progress.removingService"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await identityConnector.removeService(localIdentity, id);

	CLIDisplay.spinnerStop();

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(DocumentHelper.parse(id).id)}?tab=DID`
	);

	CLIDisplay.break();

	CLIDisplay.done();
}

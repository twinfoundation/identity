// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { Converter, I18n, Is, StringHelper, Urn } from "@twin.org/core";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

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
		.option(
			I18n.formatMessage("commands.identity-create.options.addressIndex.param"),
			I18n.formatMessage("commands.identity-create.options.addressIndex.description"),
			"0"
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
		.action(actionCommandIdentityCreate);

	return command;
}

/**
 * Action the identity create command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for connector.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandIdentityCreate(
	opts: {
		seed: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
		explorer: string;
		addressIndex?: string;
	} & CliOutputOptions
): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);
	const addressIndex: number = CLIParam.integer("addressIndex", opts.addressIndex ?? "0", false, 0);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.value(
		I18n.formatMessage("commands.identity-create.labels.addressIndex"),
		addressIndex
	);
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
		{ nodeEndpoint, vaultSeedId, network, addressIndex },
		opts.connector
	);

	CLIDisplay.task(I18n.formatMessage("commands.identity-create.progress.creatingIdentity"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const document = await identityConnector.createDocument(localIdentity);

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

	if (opts.connector === IdentityConnectorTypes.Iota) {
		const didUrn = Urn.fromValidString(document.id);
		const didParts = didUrn.parts();
		const objectId = didParts[3];
		CLIDisplay.value(
			I18n.formatMessage("commands.common.labels.explore"),
			`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/object/${objectId}?network=${network}`
		);
	}
	CLIDisplay.break();

	CLIDisplay.done();
}

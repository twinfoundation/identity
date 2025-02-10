// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { Converter, I18n, Is, StringHelper } from "@twin.org/core";
import { IotaStardustIdentityUtils } from "@twin.org/identity-connector-iota-stardust";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Build the service add command for the CLI.
 * @returns The command.
 */
export function buildCommandServiceAdd(): Command {
	const command = new Command();
	command
		.name("service-add")
		.summary(I18n.formatMessage("commands.service-add.summary"))
		.description(I18n.formatMessage("commands.service-add.description"))
		.requiredOption(
			I18n.formatMessage("commands.service-add.options.seed.param"),
			I18n.formatMessage("commands.service-add.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-add.options.did.param"),
			I18n.formatMessage("commands.service-add.options.did.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-add.options.id.param"),
			I18n.formatMessage("commands.service-add.options.id.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-add.options.type.param"),
			I18n.formatMessage("commands.service-add.options.type.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-add.options.endpoint.param"),
			I18n.formatMessage("commands.service-add.options.endpoint.description")
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
		.action(actionCommandServiceAdd);

	return command;
}

/**
 * Action the service add command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.did The identity of the document to add to.
 * @param opts.id The id of the service to add.
 * @param opts.type The type of the service to add.
 * @param opts.endpoint The service endpoint.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandServiceAdd(
	opts: {
		seed: string;
		did: string;
		id: string;
		type: string;
		endpoint: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
		explorer: string;
	} & CliOutputOptions
): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const did: string = CLIParam.stringValue("did", opts.did);
	const id: string = CLIParam.stringValue("id", opts.id);
	const type: string = CLIParam.stringValue("type", opts.type);
	const endpoint: string = CLIParam.url("endpoint", opts.endpoint);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(I18n.formatMessage("commands.service-add.labels.serviceId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.service-add.labels.serviceType"), type);
	CLIDisplay.value(I18n.formatMessage("commands.service-add.labels.serviceEndpoint"), endpoint);
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

	CLIDisplay.task(I18n.formatMessage("commands.service-add.progress.addingService"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const service = await identityConnector.addService(localIdentity, did, id, type, endpoint);

	CLIDisplay.spinnerStop();

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, service, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_SERVICE_ID="${service.id}"`,
				`DID_SERVICE_TYPE="${service.type}"`,
				`DID_SERVICE_ENDPOINT="${service.serviceEndpoint}"`
			],
			opts.mergeEnv
		);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaStardustIdentityUtils.didToAddress(did)}?tab=DID`
	);

	CLIDisplay.break();

	CLIDisplay.done();
}

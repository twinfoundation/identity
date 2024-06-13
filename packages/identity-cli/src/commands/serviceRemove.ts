// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam } from "@gtsc/cli-core";
import { Converter, I18n, StringHelper } from "@gtsc/core";
import { EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { IotaIdentityConnector, IotaIdentityUtils } from "@gtsc/identity-connector-iota";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { Command } from "commander";

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
		.action(actionCommandServiceRemove);

	return command;
}

/**
 * Action the service remove command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.id The id of the service to remove.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandServiceRemove(opts: {
	seed: string;
	id: string;
	node: string;
	explorer: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const id: string = CLIParam.stringValue("id", opts.id);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.service-remove.labels.serviceId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	const vaultConnector = new EntityStorageVaultConnector({
		vaultKeyEntityStorageConnector: new MemoryEntityStorageConnector<VaultKey>(
			EntitySchemaHelper.getSchema(VaultKey)
		),
		vaultSecretEntityStorageConnector: new MemoryEntityStorageConnector<VaultSecret>(
			EntitySchemaHelper.getSchema(VaultSecret)
		)
	});

	const requestContext = { identity: "local", tenantId: "local" };
	const vaultSeedId = "local-seed";

	const iotaIdentityConnector = new IotaIdentityConnector(
		{
			vaultConnector
		},
		{
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			},
			vaultSeedId
		}
	);

	await vaultConnector.setSecret(requestContext, vaultSeedId, Converter.bytesToBase64(seed));

	CLIDisplay.task(I18n.formatMessage("commands.service-remove.progress.removingService"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await iotaIdentityConnector.removeService(requestContext, id);

	CLIDisplay.spinnerStop();

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(id.split("#")[0])}?tab=DID`
	);

	CLIDisplay.break();

	CLIDisplay.done();
}

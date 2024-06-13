// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils } from "@gtsc/cli-core";
import { I18n, Is, StringHelper } from "@gtsc/core";
import { EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { Command } from "commander";
import { IdentityCliUtils } from "../identityCliUtils";

/**
 * Build the identity resolve command to the CLI.
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
 * @param opts.console Flag to display on the console.
 * @param opts.json Output the data to a JSON file.
 * @param opts.mergeJson Merge the data to a JSON file.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandIdentityResolve(opts: {
	did: string;
	console: boolean;
	json?: string;
	mergeJson: boolean;
	node: string;
	explorer: string;
}): Promise<void> {
	const did: string = CLIParam.stringValue("did", opts.did);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
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

	const iotaIdentityConnector = new IotaIdentityConnector(
		{
			vaultConnector
		},
		{
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	);

	CLIDisplay.task(I18n.formatMessage("commands.identity-resolve.progress.resolvingIdentity"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const requestContext = { identity: "local", tenantId: "local" };
	const document = await iotaIdentityConnector.resolveDocument(requestContext, did);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.section(I18n.formatMessage("commands.identity-resolve.labels.didDocument"));

		CLIDisplay.write(JSON.stringify(document, undefined, 2));
		CLIDisplay.break();
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, document, opts.mergeJson);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IdentityCliUtils.didToAddress(document.id)}?tab=DID`
	);
	CLIDisplay.break();

	CLIDisplay.done();
}

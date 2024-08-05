// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam } from "@gtsc/cli-core";
import { Converter, I18n, StringHelper } from "@gtsc/core";
import { IotaIdentityConnector, IotaIdentityUtils } from "@gtsc/identity-connector-iota";
import { DocumentHelper } from "@gtsc/identity-models";
import { VaultConnectorFactory } from "@gtsc/vault-models";

import { IotaWalletConnector } from "@gtsc/wallet-connector-iota";
import { WalletConnectorFactory } from "@gtsc/wallet-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the verification method remove command for the CLI.
 * @returns The command.
 */
export function buildCommandVerificationMethodRemove(): Command {
	const command = new Command();
	command
		.name("verification-method-remove")
		.summary(I18n.formatMessage("commands.verification-method-remove.summary"))
		.description(I18n.formatMessage("commands.verification-method-remove.description"))
		.requiredOption(
			I18n.formatMessage("commands.verification-method-remove.options.seed.param"),
			I18n.formatMessage("commands.verification-method-remove.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verification-method-remove.options.id.param"),
			I18n.formatMessage("commands.verification-method-remove.options.id.description")
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
		.action(actionCommandVerificationMethodRemove);

	return command;
}

/**
 * Action the verification method remove command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.id The id of the verification method to remove.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandVerificationMethodRemove(opts: {
	seed: string;
	id: string;
	node: string;
	explorer: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const id: string = CLIParam.stringValue("id", opts.id);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(
		I18n.formatMessage("commands.verification-method-add.labels.verificationMethodId"),
		id
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const vaultSeedId = "local-seed";
	const localIdentity = "local";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(`${localIdentity}/${vaultSeedId}`, Converter.bytesToBase64(seed));

	const iotaWalletConnector = new IotaWalletConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			},
			vaultSeedId
		}
	});
	WalletConnectorFactory.register("wallet", () => iotaWalletConnector);

	const iotaIdentityConnector = new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			},
			vaultSeedId
		}
	});

	CLIDisplay.task(
		I18n.formatMessage("commands.verification-method-remove.progress.removingVerificationMethod")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await iotaIdentityConnector.removeVerificationMethod(localIdentity, id);

	CLIDisplay.spinnerStop();

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(DocumentHelper.parse(id).id)}?tab=DID`
	);

	CLIDisplay.break();

	CLIDisplay.done();
}

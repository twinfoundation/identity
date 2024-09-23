// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIParam } from "@twin.org/cli-core";
import { Converter, I18n } from "@twin.org/core";
import { IotaIdentityConnector } from "@twin.org/identity-connector-iota";
import { VaultConnectorFactory } from "@twin.org/vault-models";

import { IotaWalletConnector } from "@twin.org/wallet-connector-iota";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the verifiable credential unrevoke command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiableCredentialUnrevoke(): Command {
	const command = new Command();
	command
		.name("verifiable-credential-unrevoke")
		.summary(I18n.formatMessage("commands.verifiable-credential-unrevoke.summary"))
		.description(I18n.formatMessage("commands.verifiable-credential-unrevoke.description"))
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-unrevoke.options.seed.param"),
			I18n.formatMessage("commands.verifiable-credential-unrevoke.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-unrevoke.options.did.param"),
			I18n.formatMessage("commands.verifiable-credential-unrevoke.options.did.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-unrevoke.options.revocation-index.param"),
			I18n.formatMessage(
				"commands.verifiable-credential-unrevoke.options.revocation-index.description"
			)
		);

	command
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.action(actionCommandVerifiableCredentialUnrevoke);

	return command;
}

/**
 * Action the verifiable credential unrevoke command.
 * @param opts The options for the command.
 * @param opts.seed The seed to generate the private key for the controller.
 * @param opts.did The id of the document to unrevoke the index.
 * @param opts.revocationIndex The revocation index for the credential.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialUnrevoke(opts: {
	seed: string;
	did: string;
	revocationIndex: string;
	node: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const did: string = CLIParam.stringValue("did", opts.did);
	const revocationIndex: number = CLIParam.integer("revocation-index", opts.revocationIndex);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-unrevoke.labels.revocationIndex"),
		revocationIndex
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
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
		I18n.formatMessage("commands.verifiable-credential-unrevoke.progress.unrevokingCredential")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await iotaIdentityConnector.unrevokeVerifiableCredentials(localIdentity, did, [revocationIndex]);

	CLIDisplay.spinnerStop();

	CLIDisplay.done();
}

// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIParam } from "@twin.org/cli-core";
import { Converter, I18n, Is } from "@twin.org/core";
import { VaultConnectorFactory } from "@twin.org/vault-models";

import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

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
		.action(actionCommandVerifiableCredentialUnrevoke);

	return command;
}

/**
 * Action the verifiable credential unrevoke command.
 * @param opts The options for the command.
 * @param opts.seed The seed to generate the private key for the controller.
 * @param opts.did The id of the document to unrevoke the index.
 * @param opts.revocationIndex The revocation index for the credential.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for rebased connector.
 */
export async function actionCommandVerifiableCredentialUnrevoke(opts: {
	seed: string;
	did: string;
	revocationIndex: string;
	connector?: IdentityConnectorTypes;
	node: string;
	network?: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const did: string = CLIParam.stringValue("did", opts.did);
	const revocationIndex: number = CLIParam.integer("revocation-index", opts.revocationIndex);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.IotaRebased
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-unrevoke.labels.revocationIndex"),
		revocationIndex
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
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

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-credential-unrevoke.progress.unrevokingCredential")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await identityConnector.unrevokeVerifiableCredentials(localIdentity, did, [revocationIndex]);

	CLIDisplay.spinnerStop();

	CLIDisplay.done();
}

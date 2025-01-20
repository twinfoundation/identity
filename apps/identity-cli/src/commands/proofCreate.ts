// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { I18n, Is } from "@twin.org/core";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Build the proof create command for the CLI.
 * @returns The command.
 */
export function buildCommandProofCreate(): Command {
	const command = new Command();
	command
		.name("proof-create")
		.summary(I18n.formatMessage("commands.proof-create.summary"))
		.description(I18n.formatMessage("commands.proof-create.description"))
		.requiredOption(
			I18n.formatMessage("commands.proof-create.options.id.param"),
			I18n.formatMessage("commands.proof-create.options.id.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-create.options.private-key.param"),
			I18n.formatMessage("commands.proof-create.options.private-key.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-create.options.data.param"),
			I18n.formatMessage("commands.proof-create.options.data.description")
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
		.action(actionCommandProofCreate);

	return command;
}

/**
 * Action the proof create command.
 * @param opts The options for the command.
 * @param opts.id The id of the verification method to use for the credential.
 * @param opts.privateKey The private key for the verification method.
 * @param opts.data The data to create the proof for.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for rebased connector.
 */
export async function actionCommandProofCreate(
	opts: {
		id: string;
		privateKey: string;
		data: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const id: string = CLIParam.stringValue("id", opts.id);
	const privateKey: Uint8Array = CLIParam.hexBase64("private-key", opts.privateKey);
	const data: Uint8Array = CLIParam.hexBase64("data", opts.data);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.IotaRebased
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	CLIDisplay.value(I18n.formatMessage("commands.proof-create.labels.verificationMethodId"), id);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.break();

	setupVault();

	const localIdentity = "local";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.addKey(
		`${localIdentity}/${id}`,
		VaultKeyType.Ed25519,
		privateKey,
		new Uint8Array()
	);

	const walletConnector = setupWalletConnector({ nodeEndpoint, network }, opts.connector);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector({ nodeEndpoint, network }, opts.connector);

	CLIDisplay.task(I18n.formatMessage("commands.proof-create.progress.creatingProof"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const proof = await identityConnector.createProof(localIdentity, id, data);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.json(proof);

		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{ cryptosuite: proof.cryptosuite, value: proof.proofValue },
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[`DID_CRYPTOSUITE="${proof.cryptosuite}"`, `DID_PROOF_VALUE="${proof.proofValue}"`],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}

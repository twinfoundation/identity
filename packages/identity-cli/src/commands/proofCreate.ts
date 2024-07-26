// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils, type CliOutputOptions } from "@gtsc/cli-core";
import { Converter, I18n, Is } from "@gtsc/core";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import { VaultConnectorFactory, VaultKeyType } from "@gtsc/vault-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

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
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
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
 * @param opts.node The node URL.
 */
export async function actionCommandProofCreate(
	opts: {
		id: string;
		privateKey: string;
		data: string;
		node: string;
	} & CliOutputOptions
): Promise<void> {
	const id: string = CLIParam.stringValue("id", opts.id);
	const privateKey: Uint8Array = CLIParam.hexBase64("private-key", opts.privateKey);
	const data: Uint8Array = CLIParam.hexBase64("data", opts.data);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(I18n.formatMessage("commands.proof-create.labels.verificationMethodId"), id);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.break();

	setupVault();

	const requestContext = { userIdentity: "local", partitionId: "local" };

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.addKey(
		id,
		VaultKeyType.Ed25519,
		privateKey,
		new Uint8Array(),
		requestContext
	);

	const iotaIdentityConnector = new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	});

	CLIDisplay.task(I18n.formatMessage("commands.proof-create.progress.creatingProof"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const proof = await iotaIdentityConnector.createProof(id, data, requestContext);

	const proofValue = Converter.bytesToBase64(proof.value);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(I18n.formatMessage("commands.proof-create.labels.type"), proof.type);
		CLIDisplay.value(I18n.formatMessage("commands.proof-create.labels.value"), proofValue);

		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{ type: proof.type, value: proofValue },
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[`DID_PROOF_TYPE="${proof.type}"`, `DID_PROOF_VALUE="${proofValue}"`],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}

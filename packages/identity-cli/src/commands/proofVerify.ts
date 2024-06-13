// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils } from "@gtsc/cli-core";
import { Converter, I18n, Is } from "@gtsc/core";
import { EntitySchemaHelper } from "@gtsc/entity";
import { MemoryEntityStorageConnector } from "@gtsc/entity-storage-connector-memory";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import {
	EntityStorageVaultConnector,
	VaultKey,
	VaultSecret
} from "@gtsc/vault-connector-entity-storage";
import { Command } from "commander";

/**
 * Build the proof verify command for the CLI.
 * @returns The command.
 */
export function buildCommandProofVerify(): Command {
	const command = new Command();
	command
		.name("proof-verify")
		.summary(I18n.formatMessage("commands.proof-verify.summary"))
		.description(I18n.formatMessage("commands.proof-verify.description"))
		.requiredOption(
			I18n.formatMessage("commands.proof-verify.options.id.param"),
			I18n.formatMessage("commands.proof-verify.options.id.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-verify.options.data.param"),
			I18n.formatMessage("commands.proof-verify.options.data.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-verify.options.type.param"),
			I18n.formatMessage("commands.proof-verify.options.type.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-verify.options.value.param"),
			I18n.formatMessage("commands.proof-verify.options.value.description")
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
		.action(actionCommandProofVerify);

	return command;
}

/**
 * Action the proof verify command.
 * @param opts The options for the command.
 * @param opts.id The id of the verification method to use for the credential.
 * @param opts.data The data to verify the proof for.
 * @param opts.type The type of the proof.
 * @param opts.value The proof value.
 * @param opts.console Flag to display on the console.
 * @param opts.json Output the data to a JSON file.
 * @param opts.mergeJson Merge the data to a JSON file.
 * @param opts.env Output the data to an environment file.
 * @param opts.mergeEnv Merge the data to an environment file.
 * @param opts.node The node URL.
 */
export async function actionCommandProofVerify(opts: {
	id: string;
	data: string;
	type: string;
	value: string;
	console: boolean;
	json?: string;
	mergeJson: boolean;
	env?: string;
	mergeEnv: boolean;
	node: string;
}): Promise<void> {
	const id: string = CLIParam.stringValue("id", opts.id);
	const data: Uint8Array = CLIParam.hexBase64("data", opts.data);
	const type: string = CLIParam.stringValue("type", opts.type);
	const value: Uint8Array = CLIParam.hexBase64("value", opts.value);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.verificationMethodId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.type"), type);
	CLIDisplay.value(
		I18n.formatMessage("commands.proof-verify.labels.value"),
		Converter.bytesToBase64(value)
	);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
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

	CLIDisplay.task(I18n.formatMessage("commands.proof-verify.progress.verifyingProof"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const isVerified = await iotaIdentityConnector.verifyProof(requestContext, id, data, type, value);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.isVerified"), isVerified);

		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, { isVerified }, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(opts.env, [`DID_PROOF_VERIFIED="${isVerified}"`], opts.mergeEnv);
	}

	CLIDisplay.done();
}

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
import { IotaIdentityConnector } from "@twin.org/identity-connector-iota";
import { DidContexts, DidTypes, type IDidProof } from "@twin.org/standards-w3c-did";
import { IotaWalletConnector } from "@twin.org/wallet-connector-iota";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

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
			I18n.formatMessage("commands.proof-verify.options.cryptosuite.param"),
			I18n.formatMessage("commands.proof-verify.options.cryptosuite.description")
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
 * @param opts.cryptosuite The cryptosuite of the proof.
 * @param opts.value The proof value.
 * @param opts.node The node URL.
 */
export async function actionCommandProofVerify(
	opts: {
		id: string;
		data: string;
		cryptosuite: string;
		value: string;
		node: string;
	} & CliOutputOptions
): Promise<void> {
	const id: string = CLIParam.stringValue("id", opts.id);
	const data: Uint8Array = CLIParam.hexBase64("data", opts.data);
	const cryptosuite: string = CLIParam.stringValue("cryptosuite", opts.cryptosuite);
	const value: string = CLIParam.stringValue("value", opts.value);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.verificationMethodId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.cryptosuite"), cryptosuite);
	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.value"), value);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.break();

	setupVault();

	const iotaWalletConnector = new IotaWalletConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	});
	WalletConnectorFactory.register("wallet", () => iotaWalletConnector);

	const iotaIdentityConnector = new IotaIdentityConnector({
		config: {
			clientOptions: {
				nodes: [nodeEndpoint],
				localPow: true
			}
		}
	});

	CLIDisplay.task(I18n.formatMessage("commands.proof-verify.progress.verifyingProof"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const proof: IDidProof = {
		"@context": DidContexts.ContextVCDataIntegrity,
		type: DidTypes.DataIntegrityProof,
		verificationMethod: id,
		cryptosuite,
		proofPurpose: "assertionMethod",
		proofValue: value
	};

	const isVerified = await iotaIdentityConnector.verifyProof(data, proof);

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

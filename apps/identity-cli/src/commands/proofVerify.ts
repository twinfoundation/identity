// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { GeneralError, I18n, Is } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IProof } from "@twin.org/standards-w3c-did";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

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
			I18n.formatMessage("commands.proof-verify.options.document-filename.param"),
			I18n.formatMessage("commands.proof-verify.options.document-filename.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.proof-verify.options.proof-filename.param"),
			I18n.formatMessage("commands.proof-verify.options.proof-filename.description")
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
		.action(actionCommandProofVerify);

	return command;
}

/**
 * Action the proof verify command.
 * @param opts The options for the command.
 * @param opts.id The id of the verification method to use for the credential.
 * @param opts.documentFilename The data to verify the proof for.
 * @param opts.proofFilename The proof value.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for connector.
 */
export async function actionCommandProofVerify(
	opts: {
		documentFilename: string;
		proofFilename: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const documentFilename: string = path.resolve(
		CLIParam.stringValue("document-filename", opts.documentFilename)
	);
	const proofFilename: string = path.resolve(
		CLIParam.stringValue("proof-filename", opts.proofFilename)
	);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	CLIDisplay.value(
		I18n.formatMessage("commands.proof-verify.labels.documentFilename"),
		documentFilename
	);
	CLIDisplay.value(I18n.formatMessage("commands.proof-verify.labels.proofFilename"), proofFilename);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.break();

	setupVault();

	const walletConnector = setupWalletConnector({ nodeEndpoint, network }, opts.connector);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector({ nodeEndpoint, network }, opts.connector);

	CLIDisplay.task(I18n.formatMessage("commands.proof-verify.progress.verifyingProof"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const document = await CLIUtils.readJsonFile<IJsonLdNodeObject>(documentFilename);
	if (Is.undefined(document)) {
		throw new GeneralError("commands", "commands.proof-verify.documentJsonFileNotFound");
	}

	const proof = await CLIUtils.readJsonFile<IProof>(proofFilename);
	if (Is.undefined(proof)) {
		throw new GeneralError("commands", "commands.proof-verify.proofJsonFileNotFound");
	}

	const isVerified = await identityConnector.verifyProof(document, proof);

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

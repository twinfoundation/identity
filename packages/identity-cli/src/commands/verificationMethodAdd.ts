// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils, type CliOutputOptions } from "@gtsc/cli-core";
import { Converter, I18n, Is, StringHelper } from "@gtsc/core";
import { IotaIdentityConnector, IotaIdentityUtils } from "@gtsc/identity-connector-iota";
import { DidVerificationMethodType } from "@gtsc/standards-w3c-did";
import { VaultConnectorFactory } from "@gtsc/vault-models";

import { Command, Option } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the verification method add command for the CLI.
 * @returns The command.
 */
export function buildCommandVerificationMethodAdd(): Command {
	const command = new Command();
	command
		.name("verification-method-add")
		.summary(I18n.formatMessage("commands.verification-method-add.summary"))
		.description(I18n.formatMessage("commands.verification-method-add.description"))
		.requiredOption(
			I18n.formatMessage("commands.verification-method-add.options.seed.param"),
			I18n.formatMessage("commands.verification-method-add.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verification-method-add.options.did.param"),
			I18n.formatMessage("commands.verification-method-add.options.did.description")
		)
		.addOption(
			new Option(
				I18n.formatMessage("commands.verification-method-add.options.type.param"),
				I18n.formatMessage("commands.verification-method-add.options.type.description")
			)
				.choices(Object.values(DidVerificationMethodType))
				.makeOptionMandatory()
		)
		.option(
			I18n.formatMessage("commands.verification-method-add.options.id.param"),
			I18n.formatMessage("commands.verification-method-add.options.id.description")
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
		.action(actionCommandVerificationMethodAdd);

	return command;
}

/**
 * Action the verification method add command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.did The identity of the document to add to.
 * @param opts.type The type of the verification method to add.
 * @param opts.id The id of the verification method to add.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandVerificationMethodAdd(
	opts: {
		seed: string;
		did: string;
		type: DidVerificationMethodType;
		id?: string;
		node: string;
		explorer: string;
	} & CliOutputOptions
): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const did: string = CLIParam.stringValue("did", opts.did);
	const type: DidVerificationMethodType = CLIParam.stringValue(
		"type",
		opts.type
	) as DidVerificationMethodType;
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(
		I18n.formatMessage("commands.verification-method-add.labels.verificationMethodType"),
		type
	);
	if (Is.stringValue(opts.id)) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.verificationMethodId"),
			opts?.id
		);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const requestContext = { identity: "local", partitionId: "local" };
	const vaultSeedId = "local-seed";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(vaultSeedId, Converter.bytesToBase64(seed), requestContext);

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
		I18n.formatMessage("commands.verification-method-add.progress.addingVerificationMethod")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verificationMethod = await iotaIdentityConnector.addVerificationMethod(
		did,
		type,
		opts?.id,
		requestContext
	);

	CLIDisplay.spinnerStop();

	const keyPair = await vaultConnector.getKey(verificationMethod.id, requestContext);
	const privateKey = Converter.bytesToBase64(keyPair.privateKey);
	const publicKey = Converter.bytesToBase64(keyPair.publicKey);

	if (opts.console) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.verificationMethodId"),
			verificationMethod.id
		);

		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.privateKey"),
			privateKey
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.publicKey"),
			publicKey
		);

		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{ verificationMethodId: verificationMethod.id, privateKey, publicKey },
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_VERIFICATION_METHOD_ID="${verificationMethod.id}"`,
				`DID_VERIFICATION_METHOD_PRIVATE_KEY="${privateKey}"`,
				`DID_VERIFICATION_METHOD_PUBLIC_KEY="${publicKey}"`
			],
			opts.mergeEnv
		);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.common.labels.explore"),
		`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/addr/${IotaIdentityUtils.didToAddress(did)}?tab=DID`
	);

	CLIDisplay.break();

	CLIDisplay.done();
}

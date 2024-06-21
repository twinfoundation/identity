// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIParam } from "@gtsc/cli-core";
import { Converter, I18n } from "@gtsc/core";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import { VaultConnectorFactory } from "@gtsc/vault-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

/**
 * Build the verifiable credential revoke command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiableCredentialRevoke(): Command {
	const command = new Command();
	command
		.name("verifiable-credential-revoke")
		.summary(I18n.formatMessage("commands.verifiable-credential-revoke.summary"))
		.description(I18n.formatMessage("commands.verifiable-credential-revoke.description"))
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-revoke.options.seed.param"),
			I18n.formatMessage("commands.verifiable-credential-revoke.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-revoke.options.did.param"),
			I18n.formatMessage("commands.verifiable-credential-revoke.options.did.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-revoke.options.revocation-index.param"),
			I18n.formatMessage(
				"commands.verifiable-credential-revoke.options.revocation-index.description"
			)
		);

	command
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.action(actionCommandVerifiableCredentialRevoke);

	return command;
}

/**
 * Action the verifiable credential revoke command.
 * @param opts The options for the command.
 * @param opts.seed The seed to generate the private key for the controller.
 * @param opts.did The id of the document to revoke the index.
 * @param opts.revocationIndex The revocation index for the credential.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialRevoke(opts: {
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
		I18n.formatMessage("commands.verifiable-credential-revoke.labels.revocationIndex"),
		revocationIndex
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	CLIDisplay.break();

	setupVault();

	const requestContext = { identity: "local", tenantId: "local" };
	const vaultSeedId = "local-seed";

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(requestContext, vaultSeedId, Converter.bytesToBase64(seed));

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
		I18n.formatMessage("commands.verifiable-credential-revoke.progress.revokingCredential")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await iotaIdentityConnector.revokeVerifiableCredentials(requestContext, did, [revocationIndex]);

	CLIDisplay.spinnerStop();

	CLIDisplay.done();
}

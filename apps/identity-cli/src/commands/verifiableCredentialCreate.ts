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
import { Coerce, GeneralError, I18n, Is } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { VaultConnectorFactory, VaultKeyType } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

/**
 * Build the verifiable credential create command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiableCredentialCreate(): Command {
	const command = new Command();
	command
		.name("verifiable-credential-create")
		.summary(I18n.formatMessage("commands.verifiable-credential-create.summary"))
		.description(I18n.formatMessage("commands.verifiable-credential-create.description"))
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-create.options.id.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.id.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-create.options.private-key.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.private-key.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-credential-create.options.credential-id.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.credential-id.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-credential-create.options.subject-json.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.subject-json.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-credential-create.options.revocation-index.param"),
			I18n.formatMessage(
				"commands.verifiable-credential-create.options.revocation-index.description"
			)
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
		.action(actionCommandVerifiableCredentialCreate);

	return command;
}

/**
 * Action the verifiable credential create command.
 * @param opts The options for the command.
 * @param opts.id The id of the verification method to use for the credential.
 * @param opts.privateKey The private key for the verification method.
 * @param opts.credentialId The id of the credential.
 * @param opts.subjectJson The JSON data for the subject.
 * @param opts.revocationIndex The revocation index for the credential.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialCreate(
	opts: {
		id: string;
		privateKey: string;
		credentialId?: string;
		subjectJson: string;
		revocationIndex?: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const id: string = CLIParam.stringValue("id", opts.id);
	const privateKey: Uint8Array = CLIParam.hexBase64("private-key", opts.privateKey);
	const credentialId: string = CLIParam.stringValue("credential-id", opts.credentialId);
	const subjectJson: string = path.resolve(CLIParam.stringValue("subject-json", opts.subjectJson));
	const revocationIndex: number | undefined = Coerce.number(opts.revocationIndex);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.IotaRebased
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.verificationMethodId"),
		id
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.credentialId"),
		credentialId
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.subjectJson"),
		subjectJson
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.revocationIndex"),
		revocationIndex
	);
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

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-credential-create.progress.loadingSubjectData")
	);
	CLIDisplay.break();

	const jsonData = await CLIUtils.readJsonFile<IJsonLdNodeObject>(subjectJson);
	if (Is.undefined(jsonData)) {
		throw new GeneralError(
			"commands",
			"commands.verifiable-credential-create.subjectJsonFileNotFound"
		);
	}

	CLIDisplay.task(
		I18n.formatMessage(
			"commands.verifiable-credential-create.progress.creatingVerifiableCredential"
		)
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verifiableCredential = await identityConnector.createVerifiableCredential(
		localIdentity,
		id,
		credentialId,
		jsonData,
		revocationIndex
	);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.section(
			I18n.formatMessage("commands.verifiable-credential-create.labels.verifiableCredential")
		);

		CLIDisplay.write(verifiableCredential.jwt);
		CLIDisplay.break();
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{ verifiableCredentialJwt: verifiableCredential.jwt },
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[`DID_VERIFIABLE_CREDENTIAL_JWT="${verifiableCredential.jwt}"`],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}

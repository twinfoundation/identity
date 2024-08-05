// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { CLIDisplay, CLIOptions, CLIParam, CLIUtils, type CliOutputOptions } from "@gtsc/cli-core";
import { Coerce, GeneralError, Guards, I18n, Is } from "@gtsc/core";
import { IotaIdentityConnector } from "@gtsc/identity-connector-iota";
import { VaultConnectorFactory, VaultKeyType } from "@gtsc/vault-models";

import { IotaWalletConnector } from "@gtsc/wallet-connector-iota";
import { WalletConnectorFactory } from "@gtsc/wallet-models";
import { Command } from "commander";
import { setupVault } from "./setupCommands";

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
		.option(
			I18n.formatMessage("commands.verifiable-credential-create.options.types.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.types.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-credential-create.options.contexts.param"),
			I18n.formatMessage("commands.verifiable-credential-create.options.contexts.description")
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
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
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
 * @param opts.types The types for the credential.
 * @param opts.subjectJson The JSON data for the subject.
 * @param opts.contexts The contexts for the credential.
 * @param opts.revocationIndex The revocation index for the credential.
 * @param opts.node The node URL.
 */
export async function actionCommandVerifiableCredentialCreate(
	opts: {
		id: string;
		privateKey: string;
		credentialId?: string;
		types?: string[];
		subjectJson: string;
		contexts?: string[];
		revocationIndex?: string;
		node: string;
	} & CliOutputOptions
): Promise<void> {
	if (!Is.undefined(opts.types)) {
		Guards.arrayValue("commands", "types", opts.types);
	}
	if (!Is.undefined(opts.contexts)) {
		Guards.arrayValue("commands", "contexts", opts.contexts);
	}

	const id: string = CLIParam.stringValue("id", opts.id);
	const privateKey: Uint8Array = CLIParam.hexBase64("private-key", opts.privateKey);
	const credentialId: string = CLIParam.stringValue("credential-id", opts.credentialId);
	const types: string[] | undefined = opts.types;
	const contexts: string[] | undefined = opts.contexts;
	const subjectJson: string = path.resolve(CLIParam.stringValue("subject-json", opts.subjectJson));
	const revocationIndex: number | undefined = Coerce.number(opts.revocationIndex);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);

	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.verificationMethodId"),
		id
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.credentialId"),
		credentialId
	);
	if (Is.arrayValue(types)) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-create.labels.types"),
			types.join(",")
		);
	}
	if (Is.arrayValue(contexts)) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-credential-create.labels.contexts"),
			contexts.join(",")
		);
	}
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.subjectJson"),
		subjectJson
	);
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-credential-create.labels.revocationIndex"),
		revocationIndex
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
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

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-credential-create.progress.loadingSubjectData")
	);
	CLIDisplay.break();

	const jsonData = await CLIUtils.readJsonFile(subjectJson);
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

	const verifiableCredential = await iotaIdentityConnector.createVerifiableCredential(
		localIdentity,
		id,
		credentialId,
		types,
		jsonData,
		contexts,
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

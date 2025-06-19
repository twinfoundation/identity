// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@twin.org/cli-core";
import { Converter, I18n, Is, StringHelper, Urn } from "@twin.org/core";
import { DocumentHelper } from "@twin.org/identity-models";
import { DidVerificationMethodType } from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupWalletConnector } from "@twin.org/wallet-cli";
import { WalletConnectorFactory } from "@twin.org/wallet-models";
import { Jwk } from "@twin.org/web";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes";

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
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandVerificationMethodAdd(
	opts: {
		seed: string;
		did: string;
		type: DidVerificationMethodType;
		id?: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
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
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;
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
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
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
		I18n.formatMessage("commands.verification-method-add.progress.addingVerificationMethod")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verificationMethod = await identityConnector.addVerificationMethod(
		localIdentity,
		did,
		type,
		opts?.id
	);

	CLIDisplay.spinnerStop();

	const keyParts = DocumentHelper.parseId(verificationMethod.id);

	const keyPair = await vaultConnector.getKey(`${localIdentity}/${keyParts.fragment}`);
	const privateKeyBase64 = Converter.bytesToBase64Url(keyPair.privateKey);
	const publicKeyBase64 = Is.uint8Array(keyPair.publicKey)
		? Converter.bytesToBase64Url(keyPair.publicKey)
		: "";

	const privateKeyHex = Converter.bytesToHex(keyPair.privateKey, true);
	const publicKeyHex = Is.uint8Array(keyPair.publicKey)
		? Converter.bytesToHex(keyPair.publicKey, true)
		: "";

	if (opts.console) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.verificationMethodId"),
			verificationMethod.id
		);

		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.privateKeyBase64"),
			privateKeyBase64
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.publicKeyBase64"),
			publicKeyBase64
		);

		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.privateKeyHex"),
			privateKeyHex
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verification-method-add.labels.publicKeyHex"),
			publicKeyHex
		);

		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		const jwk = await Jwk.fromEd25519Private(keyPair.privateKey);
		const kid = await Jwk.generateKid(jwk);
		await CLIUtils.writeJsonFile(
			opts.json,
			{
				kid,
				...jwk
			},
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_VERIFICATION_METHOD_ID="${verificationMethod.id}"`,
				`DID_VERIFICATION_METHOD_PRIVATE_KEY="${privateKeyHex}"`,
				`DID_VERIFICATION_METHOD_PUBLIC_KEY="${publicKeyHex}"`
			],
			opts.mergeEnv
		);
	}

	if (opts.connector === IdentityConnectorTypes.Iota) {
		const didUrn = Urn.fromValidString(did);
		const didParts = didUrn.parts();
		const objectId = didParts[3];
		CLIDisplay.value(
			I18n.formatMessage("commands.common.labels.explore"),
			`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/object/${objectId}?network=${network}`
		);
	}

	CLIDisplay.break();

	CLIDisplay.done();
}

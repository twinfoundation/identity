// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { nameof } from "@twin.org/nameof";
import { ProofHelper, type IDidDocument, type IProof } from "@twin.org/standards-w3c-did";
import { Jwk, Jwt, type IJwtHeader, type IJwtPayload } from "@twin.org/web";
import { DocumentHelper } from "./documentHelper";
import type { IIdentityResolverComponent } from "../models/IIdentityResolverComponent";

/**
 * Helper methods for verification.
 */
export class VerificationHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<VerificationHelper>();

	/**
	 * Verified the JWT.
	 * @param resolver The resolver to use for finding the document.
	 * @param jwt The token to verify.
	 * @returns The decoded payload.
	 */
	public static async verifyJwt<T extends IJwtHeader, U extends IJwtPayload>(
		resolver: IIdentityResolverComponent,
		jwt: string
	): Promise<{
		header: T;
		payload: U;
	}> {
		Guards.object<IIdentityResolverComponent>(
			VerificationHelper.CLASS_NAME,
			nameof(resolver),
			resolver
		);
		Guards.string(VerificationHelper.CLASS_NAME, nameof(jwt), jwt);

		const jwtDecoded = await Jwt.decode<T, U>(jwt);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (!Is.object(jwtHeader) || !Is.object(jwtPayload) || !Is.uint8Array(jwtSignature)) {
			throw new GeneralError(VerificationHelper.CLASS_NAME, "jwtDecodeFailed");
		}

		const iss = jwtHeader?.iss;
		const kid = jwtHeader?.kid;

		Guards.stringValue(VerificationHelper.CLASS_NAME, nameof(iss), iss);
		Guards.stringValue(VerificationHelper.CLASS_NAME, nameof(kid), kid);

		const didDocument = await resolver.identityResolve(iss);

		const jwk = DocumentHelper.getJwk(didDocument, kid);

		const publicKey = await Jwk.toCryptoKey(jwk);

		return Jwt.verify(jwt, publicKey);
	}

	/**
	 * Verified the proof for the document e.g. verifiable credential.
	 * @param resolver The resolver to use for finding the document.
	 * @param secureDocument The secure document to verify.
	 * @returns True if the verification is successful.
	 */
	public static async verifyProof(
		resolver: IIdentityResolverComponent,
		secureDocument: IJsonLdNodeObject
	): Promise<boolean> {
		Guards.object<IIdentityResolverComponent>(
			VerificationHelper.CLASS_NAME,
			nameof(resolver),
			resolver
		);
		Guards.object<IJsonLdNodeObject>(
			VerificationHelper.CLASS_NAME,
			nameof(secureDocument),
			secureDocument
		);
		Guards.object<IJsonLdNodeObject>(
			VerificationHelper.CLASS_NAME,
			nameof(secureDocument.proof),
			secureDocument.proof
		);

		const proofList = Is.array<IProof>(secureDocument.proof)
			? secureDocument.proof
			: [secureDocument.proof];

		const documentCache: { [key: string]: IDidDocument } = {};

		for (const proof of proofList as IProof[]) {
			if (!Is.stringValue(proof?.verificationMethod)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "proofMissingVerificationMethod");
			}

			const proofVerificationMethod = DocumentHelper.parseId(proof.verificationMethod);
			if (!Is.stringValue(proofVerificationMethod.fragment)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "proofMissingVerificationMethod");
			}

			let document: IDidDocument;

			if (documentCache[proofVerificationMethod.id]) {
				document = documentCache[proofVerificationMethod.id];
			} else {
				document = await resolver.identityResolve(proofVerificationMethod.id);
				documentCache[proofVerificationMethod.id] = document;
			}

			const verificationJwk = await DocumentHelper.getJwk(document, proofVerificationMethod.id);

			const verified = ProofHelper.verifyProof(secureDocument, proof, verificationJwk);

			if (!verified) {
				return false;
			}
		}
		return true;
	}
}

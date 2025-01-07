// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Is } from "@twin.org/core";
import { nameof } from "@twin.org/nameof";
import { type IJwtHeader, type IJwtPayload, Jwt } from "@twin.org/web";

/**
 * Helper methods for JSON Web Tokens.
 */
export class JwtHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<JwtHelper>();

	/**
	 * Parse the token and check that the properties are valid.
	 * @param jwt The token top validate.
	 * @param paramsToCheck Parameters to check they exist.
	 * @returns The token components.
	 * @throws Error if the token is invalid.
	 */
	public static async parse<U extends IJwtHeader, T extends IJwtPayload>(
		jwt: string,
		paramsToCheck?: string[]
	): Promise<{
		header?: U;
		payload?: T;
		signature?: Uint8Array;
	}> {
		const jwtDecoded = await Jwt.decode<U, T>(jwt);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (Is.undefined(jwtHeader) || Is.undefined(jwtPayload) || Is.undefined(jwtSignature)) {
			throw new GeneralError(JwtHelper.CLASS_NAME, "jwtDecodeFailed");
		}

		if (Is.arrayValue(paramsToCheck)) {
			for (const param of paramsToCheck) {
				if (!Is.stringValue(jwtPayload[param])) {
					throw new GeneralError(JwtHelper.CLASS_NAME, "jwtPayloadMissingParam", {
						param
					});
				}
			}
		}

		return jwtDecoded;
	}
}

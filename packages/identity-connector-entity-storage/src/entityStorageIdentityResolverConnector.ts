// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is, NotFoundError } from "@twin.org/core";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@twin.org/entity-storage-models";
import type { IIdentityResolverConnector } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import type { IDidDocument } from "@twin.org/standards-w3c-did";
import { VaultConnectorFactory, type IVaultConnector } from "@twin.org/vault-models";
import type { IdentityDocument } from "./entities/identityDocument";
import { EntityStorageIdentityConnector } from "./entityStorageIdentityConnector";
import type { IEntityStorageIdentityResolverConnectorConstructorOptions } from "./models/IEntityStorageIdentityResolverConnectorConstructorOptions";

/**
 * Class for performing identity operations using entity storage.
 */
export class EntityStorageIdentityResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "entity-storage";

	/**
	 * Runtime name for the class.
	 */
	public readonly CLASS_NAME: string = nameof<EntityStorageIdentityResolverConnector>();

	/**
	 * The entity storage for identities.
	 * @internal
	 */
	protected readonly _didDocumentEntityStorage: IEntityStorageConnector<IdentityDocument>;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	protected readonly _vaultConnector: IVaultConnector;

	/**
	 * Create a new instance of EntityStorageIdentityResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options?: IEntityStorageIdentityResolverConnectorConstructorOptions) {
		this._didDocumentEntityStorage = EntityStorageConnectorFactory.get(
			options?.didDocumentEntityStorageType ?? "identity-document"
		);
		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(this.CLASS_NAME, nameof(documentId), documentId);

		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(this.CLASS_NAME, "documentNotFound", documentId);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);

			return didIdentityDocument.document;
		} catch (error) {
			throw new GeneralError(this.CLASS_NAME, "resolveDocumentFailed", undefined, error);
		}
	}
}

# Class: IotaIdentityProvider

Class for performing identity operations on IOTA.

## Implements

- `IIdentityProvider`

## Constructors

### constructor

• **new IotaIdentityProvider**(`config`): [`IotaIdentityProvider`](IotaIdentityProvider.md)

Create a new instance of IotaIdentityProvider.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `config` | [`IIotaIdentityProviderConfig`](../interfaces/IIotaIdentityProviderConfig.md) | The configuration to use. |

#### Returns

[`IotaIdentityProvider`](IotaIdentityProvider.md)

## Properties

### NAMESPACE

▪ `Static` **NAMESPACE**: `string` = `"iota"`

The namespace supported by the identity provider.

## Methods

### addService

▸ **addService**(`documentId`, `documentKeyPair`, `serviceId`, `serviceType`, `serviceEndpoint`): `Promise`\<`IDidDocument`\>

Add a service to the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to add the service to. |
| `documentKeyPair` | `IKeyPair` | The key required to sign the updated document. |
| `serviceId` | `string` | The id of the service. |
| `serviceType` | `string` | The type of the service. |
| `serviceEndpoint` | `string` | The endpoint for the service. |

#### Returns

`Promise`\<`IDidDocument`\>

The updated document.

**`Throws`**

NotFoundError if the id can not be resolved.

#### Implementation of

IIdentityProvider.addService

___

### addVerificationMethodJwk

▸ **addVerificationMethodJwk**(`documentId`, `documentKeyPair`, `verificationPublicKey`): `Promise`\<`IDidDocument`\>

Add a verification method to the document in JSON Web key Format.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to add the verification method to. |
| `documentKeyPair` | `IKeyPair` | The key required to sign the updated document. |
| `verificationPublicKey` | `string` | The public key for the verification method. |

#### Returns

`Promise`\<`IDidDocument`\>

The updated document.

**`Throws`**

NotFoundError if the id can not be resolved.

**`Throws`**

NotSupportedError if the platform does not support multiple keys.

#### Implementation of

IIdentityProvider.addVerificationMethodJwk

___

### checkVerifiableCredential

▸ **checkVerifiableCredential**\<`T`\>(`credential`): `Promise`\<`IDidCredentialVerification`\>

Check a verifiable credential is valid.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `credential` | `IDidVerifiableCredential`\<`T`\> | The credential to verify. |

#### Returns

`Promise`\<`IDidCredentialVerification`\>

Verification details for the credential.

#### Implementation of

IIdentityProvider.checkVerifiableCredential

___

### checkVerifiablePresentation

▸ **checkVerifiablePresentation**(`presentation`): `Promise`\<`IDidPresentationVerification`\>

Verify a presentation.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `presentation` | `IDidVerifiablePresentation` | The presentation to verify. |

#### Returns

`Promise`\<`IDidPresentationVerification`\>

Verification details for the presentation.

#### Implementation of

IIdentityProvider.checkVerifiablePresentation

___

### createDocument

▸ **createDocument**(`documentKeyPair`): `Promise`\<`IDidDocument`\>

Create a new document from the key pair.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentKeyPair` | `IKeyPair` | The key pair to generate the document for. |

#### Returns

`Promise`\<`IDidDocument`\>

The created document.

#### Implementation of

IIdentityProvider.createDocument

___

### createProof

▸ **createProof**(`documentId`, `bytes`, `verificationMethod`, `verificationKeyPair`): `Promise`\<\{ `type`: `string` ; `value`: `string`  }\>

Create a proof for arbitrary data with the specified verification method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document signing the data. |
| `bytes` | `Uint8Array` | The data bytes to sign. |
| `verificationMethod` | `string` | The verification method to use. |
| `verificationKeyPair` | `IKeyPair` | The key required to generate the proof. |

#### Returns

`Promise`\<\{ `type`: `string` ; `value`: `string`  }\>

The proof signature type and value.

#### Implementation of

IIdentityProvider.createProof

___

### createVerifiableCredential

▸ **createVerifiableCredential**\<`T`\>(`documentId`, `credentialId`, `schemaTypes`, `subject`, `revocationIndex`, `verificationMethod`, `verificationKeyPair`): `Promise`\<`IDidVerifiableCredential`\<`T`\>\>

Create a verifiable credential for a verification method.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document issuing the verifiable credential. |
| `credentialId` | `string` | The id of the credential. |
| `schemaTypes` | `string`[] | The type of the schemas for the data stored in the verifiable credential. |
| `subject` | `T` \| `T`[] | The subject data to store for the credential. |
| `revocationIndex` | `string` | The bitmap revocation index of the credential. |
| `verificationMethod` | `string` | The verification method to use. |
| `verificationKeyPair` | `IKeyPair` | The key required to generate the verifiable credential. |

#### Returns

`Promise`\<`IDidVerifiableCredential`\<`T`\>\>

The created verifiable credential.

**`Throws`**

NotFoundError if the id can not be resolved.

#### Implementation of

IIdentityProvider.createVerifiableCredential

___

### createVerifiablePresentation

▸ **createVerifiablePresentation**(`documentId`, `verifiableCredentials`, `presentationMethod`, `presentationKeyPair`, `expiresInMinutes?`): `Promise`\<`IDidVerifiablePresentation`\>

Create a verifiable presentation from the supplied verifiable credentials.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `documentId` | `string` | `undefined` | The id of the document creating the verifiable presentation. |
| `verifiableCredentials` | `IDidVerifiableCredential`\<`unknown`\> \| `IDidVerifiableCredential`\<`unknown`\>[] | `undefined` | The credentials to use for creating the presentation. |
| `presentationMethod` | `string` | `undefined` | The method to associate with the presentation. |
| `presentationKeyPair` | `IKeyPair` | `undefined` | The key required to generate the verifiable presentation. |
| `expiresInMinutes` | `number` | `-1` | The time in minutes for the presentation to expire. |

#### Returns

`Promise`\<`IDidVerifiablePresentation`\>

The verifiable presentation.

**`Throws`**

NotFoundError if the id can not be resolved.

**`Throws`**

NotSupportedError if the platform does not support multiple keys.

#### Implementation of

IIdentityProvider.createVerifiablePresentation

___

### removeService

▸ **removeService**(`documentId`, `documentKeyPair`, `serviceId`): `Promise`\<`IDidDocument`\>

Remove a service from the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to remove the service from. |
| `documentKeyPair` | `IKeyPair` | The key required to sign the updated document. |
| `serviceId` | `string` | The id of the service. |

#### Returns

`Promise`\<`IDidDocument`\>

The updated document.

**`Throws`**

NotFoundError if the id can not be resolved.

#### Implementation of

IIdentityProvider.removeService

___

### removeVerificationMethod

▸ **removeVerificationMethod**(`documentId`, `documentKeyPair`, `verificationMethodName`): `Promise`\<`IDidDocument`\>

Remove a verification method from the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to remove the verification method from. |
| `documentKeyPair` | `IKeyPair` | The key required to sign the updated document. |
| `verificationMethodName` | `string` | The name of the verification method. |

#### Returns

`Promise`\<`IDidDocument`\>

The updated document.

**`Throws`**

NotFoundError if the id can not be resolved.

**`Throws`**

NotSupportedError if the platform does not support multiple revocable keys.

#### Implementation of

IIdentityProvider.removeVerificationMethod

___

### resolveDocument

▸ **resolveDocument**(`documentId`): `Promise`\<`IDidDocument`\>

Resolve a document from its id.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to resolve. |

#### Returns

`Promise`\<`IDidDocument`\>

The resolved document.

**`Throws`**

NotFoundError if the id can not be resolved.

#### Implementation of

IIdentityProvider.resolveDocument

___

### revokeVerifiableCredentials

▸ **revokeVerifiableCredentials**(`documentId`, `documentKeyPair`, `credentialIndices`): `Promise`\<`IDidDocument`\>

Revoke verifiable credential(s).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to update the revocation list for. |
| `documentKeyPair` | `IKeyPair` | The key required to sign the updated document. |
| `credentialIndices` | `number`[] | The revocation bitmap index or indices to revoke. |

#### Returns

`Promise`\<`IDidDocument`\>

Nothing.

#### Implementation of

IIdentityProvider.revokeVerifiableCredentials

___

### verifyProof

▸ **verifyProof**(`documentId`, `bytes`, `verificationMethod`, `signatureType`, `signatureValue`): `Promise`\<`boolean`\>

Verify proof for arbitrary data with the specified verification method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document verifying the data. |
| `bytes` | `Uint8Array` | The data bytes to verify. |
| `verificationMethod` | `string` | The verification method to use. |
| `signatureType` | `string` | The type of the signature for the proof. |
| `signatureValue` | `string` | The value of the signature for the proof. |

#### Returns

`Promise`\<`boolean`\>

True if the signature is valid.

#### Implementation of

IIdentityProvider.verifyProof

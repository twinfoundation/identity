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

▸ **addService**(`documentId`, `documentPrivateKey`, `serviceId`, `serviceType`, `serviceEndpoint`): `Promise`\<`IDidDocument`\>

Add a service to the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to add the service to. |
| `documentPrivateKey` | `Uint8Array` | The private key required to sign the updated document. |
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

### addVerificationMethod

▸ **addVerificationMethod**(`documentId`, `documentPrivateKey`, `verificationPublicKey`): `Promise`\<`IDidDocument`\>

Add a verification method to the document in JSON Web key Format.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to add the verification method to. |
| `documentPrivateKey` | `Uint8Array` | The private key required to sign the updated document. |
| `verificationPublicKey` | `Uint8Array` | The public key for the verification method. |

#### Returns

`Promise`\<`IDidDocument`\>

The updated document.

**`Throws`**

NotFoundError if the id can not be resolved.

**`Throws`**

NotSupportedError if the platform does not support multiple keys.

#### Implementation of

IIdentityProvider.addVerificationMethod

___

### checkVerifiableCredential

▸ **checkVerifiableCredential**\<`T`\>(`credentialJwt`): `Promise`\<\{ `revoked`: `boolean` ; `verifiableCredential?`: `IDidVerifiableCredential`\<`T`\>  }\>

Check a verifiable credential is valid.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `credentialJwt` | `string` | The credential to verify. |

#### Returns

`Promise`\<\{ `revoked`: `boolean` ; `verifiableCredential?`: `IDidVerifiableCredential`\<`T`\>  }\>

The credential stored in the jwt and the revocation status.

#### Implementation of

IIdentityProvider.checkVerifiableCredential

___

### checkVerifiablePresentation

▸ **checkVerifiablePresentation**(`presentationJwt`): `Promise`\<\{ `issuers?`: `IDidDocument`[] ; `revoked`: `boolean` ; `verifiablePresentation?`: `IDidVerifiablePresentation`  }\>

Check a verifiable presentation is valid.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `presentationJwt` | `string` | The presentation to verify. |

#### Returns

`Promise`\<\{ `issuers?`: `IDidDocument`[] ; `revoked`: `boolean` ; `verifiablePresentation?`: `IDidVerifiablePresentation`  }\>

The presentation stored in the jwt and the revocation status.

#### Implementation of

IIdentityProvider.checkVerifiablePresentation

___

### createDocument

▸ **createDocument**(`documentPrivateKey`, `documentPublicKey`): `Promise`\<`IDidDocument`\>

Create a new document from the key pair.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentPrivateKey` | `Uint8Array` | The private key to use in generating the document. |
| `documentPublicKey` | `Uint8Array` | The public key to use in generating the document. |

#### Returns

`Promise`\<`IDidDocument`\>

The created document.

#### Implementation of

IIdentityProvider.createDocument

___

### createProof

▸ **createProof**(`documentId`, `verificationMethodId`, `verificationPrivateKey`, `bytes`): `Promise`\<\{ `type`: `string` ; `value`: `Uint8Array`  }\>

Create a proof for arbitrary data with the specified verification method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document signing the data. |
| `verificationMethodId` | `string` | The verification method id to use. |
| `verificationPrivateKey` | `Uint8Array` | The private key required to generate the proof. |
| `bytes` | `Uint8Array` | The data bytes to sign. |

#### Returns

`Promise`\<\{ `type`: `string` ; `value`: `Uint8Array`  }\>

The proof signature type and value.

#### Implementation of

IIdentityProvider.createProof

___

### createVerifiableCredential

▸ **createVerifiableCredential**\<`T`\>(`issuerDocumentId`, `assertionMethodId`, `assertionMethodPrivateKey`, `credentialId`, `schemaTypes`, `subject`, `revocationIndex`): `Promise`\<\{ `jwt`: `string` ; `verifiableCredential`: `IDidVerifiableCredential`\<`T`\>  }\>

Create a verifiable credential for a verification method.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `issuerDocumentId` | `string` | The id of the document issuing the verifiable credential. |
| `assertionMethodId` | `string` | The assertion id to use. |
| `assertionMethodPrivateKey` | `Uint8Array` | The private key required to generate the verifiable credential. |
| `credentialId` | `string` | The id of the credential. |
| `schemaTypes` | `string` \| `string`[] | The type of the schemas for the data stored in the verifiable credential. |
| `subject` | `T` \| `T`[] | The subject data to store for the credential. |
| `revocationIndex` | `number` | The bitmap revocation index of the credential. |

#### Returns

`Promise`\<\{ `jwt`: `string` ; `verifiableCredential`: `IDidVerifiableCredential`\<`T`\>  }\>

The created verifiable credential and its token.

**`Throws`**

NotFoundError if the id can not be resolved.

#### Implementation of

IIdentityProvider.createVerifiableCredential

___

### createVerifiablePresentation

▸ **createVerifiablePresentation**(`holderDocumentId`, `presentationMethodId`, `presentationPrivateKey`, `schemaTypes`, `verifiableCredentials`, `expiresInMinutes?`): `Promise`\<\{ `jwt`: `string` ; `verifiablePresentation`: `IDidVerifiablePresentation`  }\>

Create a verifiable presentation from the supplied verifiable credentials.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `holderDocumentId` | `string` | The id of the document creating the verifiable presentation. |
| `presentationMethodId` | `string` | The method to associate with the presentation. |
| `presentationPrivateKey` | `Uint8Array` | The private key required to generate the verifiable presentation. |
| `schemaTypes` | `string` \| `string`[] | The type of the schemas for the data stored in the verifiable credential. |
| `verifiableCredentials` | `string`[] | The credentials to use for creating the presentation in jwt format. |
| `expiresInMinutes?` | `number` | The time in minutes for the presentation to expire. |

#### Returns

`Promise`\<\{ `jwt`: `string` ; `verifiablePresentation`: `IDidVerifiablePresentation`  }\>

The created verifiable presentation and its token.

**`Throws`**

NotFoundError if the id can not be resolved.

**`Throws`**

NotSupportedError if the platform does not support multiple keys.

#### Implementation of

IIdentityProvider.createVerifiablePresentation

___

### removeService

▸ **removeService**(`documentId`, `documentPrivateKey`, `serviceId`): `Promise`\<`IDidDocument`\>

Remove a service from the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to remove the service from. |
| `documentPrivateKey` | `Uint8Array` | The private key required to sign the updated document. |
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

▸ **removeVerificationMethod**(`documentId`, `documentPrivateKey`, `verificationMethodId`): `Promise`\<`IDidDocument`\>

Remove a verification method from the document.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document to remove the verification method from. |
| `documentPrivateKey` | `Uint8Array` | The key required to sign the updated document. |
| `verificationMethodId` | `string` | The id of the verification method. |

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

▸ **revokeVerifiableCredentials**(`issuerDocumentId`, `issuerDocumentPrivateKey`, `credentialIndices`): `Promise`\<`IDidDocument`\>

Revoke verifiable credential(s).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `issuerDocumentId` | `string` | The id of the document to update the revocation list for. |
| `issuerDocumentPrivateKey` | `Uint8Array` | The private key required to sign the updated document. |
| `credentialIndices` | `number`[] | The revocation bitmap index or indices to revoke. |

#### Returns

`Promise`\<`IDidDocument`\>

Nothing.

#### Implementation of

IIdentityProvider.revokeVerifiableCredentials

___

### unrevokeVerifiableCredentials

▸ **unrevokeVerifiableCredentials**(`issuerDocumentId`, `issuerDocumentPrivateKey`, `credentialIndices`): `Promise`\<`IDidDocument`\>

Unrevoke verifiable credential(s).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `issuerDocumentId` | `string` | The id of the document to update the revocation list for. |
| `issuerDocumentPrivateKey` | `Uint8Array` | The private key required to sign the updated document. |
| `credentialIndices` | `number`[] | The revocation bitmap index or indices to unrevoke. |

#### Returns

`Promise`\<`IDidDocument`\>

Nothing.

#### Implementation of

IIdentityProvider.unrevokeVerifiableCredentials

___

### verifyProof

▸ **verifyProof**(`documentId`, `verificationMethodId`, `signatureType`, `signatureValue`, `bytes`): `Promise`\<`boolean`\>

Verify proof for arbitrary data with the specified verification method.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `documentId` | `string` | The id of the document verifying the data. |
| `verificationMethodId` | `string` | The verification id method to use. |
| `signatureType` | `string` | The type of the signature for the proof. |
| `signatureValue` | `Uint8Array` | The value of the signature for the proof. |
| `bytes` | `Uint8Array` | The data bytes to verify. |

#### Returns

`Promise`\<`boolean`\>

True if the signature is valid.

#### Implementation of

IIdentityProvider.verifyProof

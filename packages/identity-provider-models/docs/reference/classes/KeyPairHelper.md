# Class: KeyPairHelper

Class for helping with key pair creation.

## Constructors

### constructor

• **new KeyPairHelper**(): [`KeyPairHelper`](KeyPairHelper.md)

#### Returns

[`KeyPairHelper`](KeyPairHelper.md)

## Methods

### fromMnemonic

▸ **fromMnemonic**(`type`, `mnemonic`): [`IKeyPair`](../interfaces/IKeyPair.md)

Generate a new key pair.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | [`Ed25519`](../enums/KeyType.md#ed25519) | The key type to generate. |
| `mnemonic` | `string` | The mnemonic to use for key generation. |

#### Returns

[`IKeyPair`](../interfaces/IKeyPair.md)

The new key pair.

___

### keyPair

▸ **keyPair**(`type`): `Object`

Generate a new key pair.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | [`Ed25519`](../enums/KeyType.md#ed25519) | The key type to generate. |

#### Returns

`Object`

The new key pair.

| Name | Type | Description |
| :------ | :------ | :------ |
| `keyPair` | [`IKeyPair`](../interfaces/IKeyPair.md) | The key pair that was generated. |
| `mnemonic` | `string` | The mnemonic for recovering the key. |

___

### nameToPath

▸ **nameToPath**(`name`): `string`

Convert a text name to a Bip32 path.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | The name to convert to a path. |

#### Returns

`string`

The path.

___

### subKeyPair

▸ **subKeyPair**(`keyPair`, `path`): [`IKeyPair`](../interfaces/IKeyPair.md)

Generate a sub key pair by index.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `keyPair` | [`IKeyPair`](../interfaces/IKeyPair.md) | The root key pair. |
| `path` | `string` | The sub key path to generate in Bip32 format eg m/0/1/2/3 . |

#### Returns

[`IKeyPair`](../interfaces/IKeyPair.md)

The sub key pair.

___

### subKeyPairs

▸ **subKeyPairs**(`keyPair`, `pathRoot`, `start`, `count`): [`IKeyPair`](../interfaces/IKeyPair.md)[]

Generate a sub key pair list.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `keyPair` | [`IKeyPair`](../interfaces/IKeyPair.md) | The root key pair. |
| `pathRoot` | `string` | The sub key path root to generate in Bip32 format eg m/0/1/2/3 . |
| `start` | `number` | The start index of the sub key to generate. |
| `count` | `number` | The number of sub keys to generate. |

#### Returns

[`IKeyPair`](../interfaces/IKeyPair.md)[]

The sub key pair list.

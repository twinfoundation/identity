# Class: IdentityProviderFactory

Factory for creating identity providers.

## Constructors

### constructor

• **new IdentityProviderFactory**(): [`IdentityProviderFactory`](IdentityProviderFactory.md)

#### Returns

[`IdentityProviderFactory`](IdentityProviderFactory.md)

## Methods

### get

▸ **get**\<`T`\>(`type`, `...args`): [`IIdentityProvider`](../interfaces/IIdentityProvider.md)

Get an identity provider instance.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`IIdentityProvider`](../interfaces/IIdentityProvider.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `string` | The type of the identity provider to generate. |
| `...args` | `any`[] | To create the instance with. |

#### Returns

[`IIdentityProvider`](../interfaces/IIdentityProvider.md)

An instance of the identity provider.

**`Throws`**

GuardError if the parameters are invalid.

**`Throws`**

GeneralError if no provider exists to get.

___

### getIfExists

▸ **getIfExists**\<`T`\>(`type`, `...args`): `undefined` \| [`IIdentityProvider`](../interfaces/IIdentityProvider.md)

Get an identity provider with no exceptions.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`IIdentityProvider`](../interfaces/IIdentityProvider.md) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `string` | The type of the identity provider to generate. |
| `...args` | `any`[] | To create the instance with. |

#### Returns

`undefined` \| [`IIdentityProvider`](../interfaces/IIdentityProvider.md)

An instance of the identity provider or undefined if it does not exist.

___

### register

▸ **register**(`type`, `generator`): `void`

Register a new identity provider.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `string` | The type of the identity provider. |
| `generator` | (...`args`: `any`[]) => [`IIdentityProvider`](../interfaces/IIdentityProvider.md) | The function to create an instance. |

#### Returns

`void`

___

### reset

▸ **reset**(): `void`

Reset all the provider instances.

#### Returns

`void`

___

### unregister

▸ **unregister**(`type`): `void`

Unregister an identity provider.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `type` | `string` | The name of the identity provider to unregister. |

#### Returns

`void`

**`Throws`**

GuardError if the parameters are invalid.

**`Throws`**

GeneralError if no provider exists.

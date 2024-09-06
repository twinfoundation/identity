# Interface: IIdentityProfileConnector

Interface describing a contract which provides profile operations.

## Extends

- `IComponent`

## Properties

### CLASS\_NAME

> `readonly` **CLASS\_NAME**: `string`

The name of the component.

#### Inherited from

`IComponent.CLASS_NAME`

## Methods

### bootstrap()?

> `optional` **bootstrap**(`nodeLoggingConnectorType`?): `Promise`\<`boolean`\>

Bootstrap the component by creating and initializing any resources it needs.

#### Parameters

• **nodeLoggingConnectorType?**: `string`

The node logging connector type, defaults to "node-logging".

#### Returns

`Promise`\<`boolean`\>

True if the bootstrapping process was successful.

#### Inherited from

`IComponent.bootstrap`

***

### start()?

> `optional` **start**(`nodeIdentity`, `nodeLoggingConnectorType`?): `Promise`\<`void`\>

The component needs to be started when the node is initialized.

#### Parameters

• **nodeIdentity**: `string`

The identity of the node starting the component.

• **nodeLoggingConnectorType?**: `string`

The node logging connector type, defaults to "node-logging".

#### Returns

`Promise`\<`void`\>

Nothing.

#### Inherited from

`IComponent.start`

***

### stop()?

> `optional` **stop**(`nodeIdentity`, `nodeLoggingConnectorType`?): `Promise`\<`void`\>

The component needs to be stopped when the node is closed.

#### Parameters

• **nodeIdentity**: `string`

The identity of the node stopping the component.

• **nodeLoggingConnectorType?**: `string`

The node logging connector type, defaults to "node-logging".

#### Returns

`Promise`\<`void`\>

Nothing.

#### Inherited from

`IComponent.stop`

***

### create()

> **create**(`identity`, `publicProfile`?, `privateProfile`?): `Promise`\<`void`\>

Create the profile properties for an identity.

#### Parameters

• **identity**: `string`

The identity of the profile to create.

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### get()

> **get**(`identity`, `publicPropertyNames`?, `privatePropertyNames`?): `Promise`\<`object`\>

Get the profile properties for an identity.

#### Parameters

• **identity**: `string`

The identity of the item to get.

• **publicPropertyNames?**: `string`[]

The public properties to get for the profile, defaults to all.

• **privatePropertyNames?**: `string`[]

The private properties to get for the profile, defaults to all.

#### Returns

`Promise`\<`object`\>

The identity profile, will only return private data if you have correct permissions.

##### publicProfile?

> `optional` **publicProfile**: `unknown`

##### privateProfile?

> `optional` **privateProfile**: `unknown`

***

### update()

> **update**(`identity`, `publicProfile`?, `privateProfile`?): `Promise`\<`void`\>

Update the profile properties of an identity.

#### Parameters

• **identity**: `string`

The identity to update.

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### remove()

> **remove**(`identity`): `Promise`\<`void`\>

Delete the profile for an identity.

#### Parameters

• **identity**: `string`

The identity to delete.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### list()

> **list**(`publicFilters`?, `privateFilters`?, `publicPropertyNames`?, `privatePropertyNames`?, `cursor`?, `pageSize`?): `Promise`\<`object`\>

Get a list of the requested identities.

#### Parameters

• **publicFilters?**: `object`[]

The filters to apply to the identities public profiles.

• **privateFilters?**: `object`[]

The filters to apply to the identities private profiles.

• **publicPropertyNames?**: `string`[]

The public properties to get for the profile, defaults to all.

• **privatePropertyNames?**: `string`[]

The private properties to get for the profile, defaults to all.

• **cursor?**: `string`

The cursor for paged requests.

• **pageSize?**: `number`

The maximum number of items in a page.

#### Returns

`Promise`\<`object`\>

The list of items and cursor for paging.

##### items

> **items**: `object`[]

The identity profiles.

##### cursor?

> `optional` **cursor**: `string`

An optional cursor, when defined can be used to call find to get more entities.

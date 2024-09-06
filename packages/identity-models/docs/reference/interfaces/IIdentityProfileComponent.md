# Interface: IIdentityProfileComponent

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

> **create**(`publicProfile`?, `privateProfile`?, `identity`?): `Promise`\<`void`\>

Create the profile properties for an identity.

#### Parameters

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

• **identity?**: `string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### get()

> **get**(`publicPropertyNames`?, `privatePropertyNames`?, `identity`?): `Promise`\<`object`\>

Get the profile properties for an identity.

#### Parameters

• **publicPropertyNames?**: `string`[]

The public properties to get for the profile, defaults to all.

• **privatePropertyNames?**: `string`[]

The private properties to get for the profile, defaults to all.

• **identity?**: `string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`object`\>

The items identity and the properties.

##### identity

> **identity**: `string`

##### publicProfile?

> `optional` **publicProfile**: `unknown`

##### privateProfile?

> `optional` **privateProfile**: `unknown`

***

### getPublic()

> **getPublic**(`identity`, `propertyNames`?): `Promise`\<`unknown`\>

Get the public profile properties for an identity.

#### Parameters

• **identity**: `string`

The identity to perform the profile operation on.

• **propertyNames?**: `string`[]

The public properties to get for the profile, defaults to all.

#### Returns

`Promise`\<`unknown`\>

The items properties.

***

### update()

> **update**(`publicProfile`?, `privateProfile`?, `identity`?): `Promise`\<`void`\>

Update the profile properties of an identity.

#### Parameters

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

• **identity?**: `string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### remove()

> **remove**(`identity`?): `Promise`\<`void`\>

Delete the profile for an identity.

#### Parameters

• **identity?**: `string`

The identity to perform the profile operation on.

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

The identities.

##### cursor?

> `optional` **cursor**: `string`

An optional cursor, when defined can be used to call find to get more entities.

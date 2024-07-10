# Interface: IIdentity

Interface describing a contract which provides identity operations.

## Extends

- `IService`

## Properties

### CLASS\_NAME

> `readonly` **CLASS\_NAME**: `string`

The name of the service.

#### Inherited from

`IService.CLASS_NAME`

## Methods

### bootstrap()?

> `optional` **bootstrap**(`requestContext`): `Promise`\<`void`\>

Bootstrap the service by creating and initializing any resources it needs.

#### Parameters

• **requestContext**: `IRequestContext`

The request context for bootstrapping.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Inherited from

`IService.bootstrap`

***

### start()?

> `optional` **start**(): `Promise`\<`void`\>

The service needs to be started when the application is initialized.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Inherited from

`IService.start`

***

### stop()?

> `optional` **stop**(): `Promise`\<`void`\>

The service needs to be stopped when the application is closed.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Inherited from

`IService.stop`

***

### identityCreate()

> **identityCreate**(`requestContext`, `controller`, `role`, `properties`?): `Promise`\<`object`\>

Create a new identity.

#### Parameters

• **requestContext**: `IRequestContext`

The context for the request.

• **controller**: `string`

The controller for the identity.

• **role**: [`IdentityRole`](../type-aliases/IdentityRole.md)

The role for the identity.

• **properties?**: `IProperty`[]

The profile properties.

#### Returns

`Promise`\<`object`\>

The created identity details.

##### identity

> **identity**: `string`

The identity created.

***

### identityGet()

> **identityGet**(`requestContext`, `identity`, `propertyNames`?): `Promise`\<`object`\>

Get an item by identity.

#### Parameters

• **requestContext**: `IRequestContext`

The context for the request.

• **identity**: `string`

The identity of the item to get.

• **propertyNames?**: `string`[]

The properties to get for the item, defaults to all.

#### Returns

`Promise`\<`object`\>

The items properties.

##### role

> **role**: [`IdentityRole`](../type-aliases/IdentityRole.md)

##### properties?

> `optional` **properties**: `IProperty`[]

***

### identityUpdate()

> **identityUpdate**(`requestContext`, `identity`, `properties`): `Promise`\<`void`\>

Update an item.

#### Parameters

• **requestContext**: `IRequestContext`

The context for the request.

• **identity**: `string`

The identity to update.

• **properties**: `IProperty`[]

Properties for the profile, set a properties value to undefined to remove it.

#### Returns

`Promise`\<`void`\>

Nothing.

***

### identityList()

> **identityList**(`requestContext`, `role`, `propertyNames`?, `cursor`?, `pageSize`?): `Promise`\<`object`\>

Get a list of the requested types.

#### Parameters

• **requestContext**: `IRequestContext`

The context for the request.

• **role**: [`IdentityRole`](../type-aliases/IdentityRole.md)

The role type to lookup.

• **propertyNames?**: `string`[]

The properties to get for the identities, default to all if undefined.

• **cursor?**: `string`

The cursor for paged requests.

• **pageSize?**: `number`

The maximum number of items in a page.

#### Returns

`Promise`\<`object`\>

The list of items and cursor for paging.

##### identities

> **identities**: `object`[]

The identities.

##### cursor?

> `optional` **cursor**: `string`

An optional cursor, when defined can be used to call find to get more entities.

##### pageSize?

> `optional` **pageSize**: `number`

Number of entities to return.

##### totalEntities

> **totalEntities**: `number`

Total entities length.

# Class: IdentityProfileClient

Client for performing identity through to REST endpoints.

## Extends

- `BaseRestClient`

## Implements

- `IIdentityProfileComponent`

## Constructors

### new IdentityProfileClient()

> **new IdentityProfileClient**(`config`): [`IdentityProfileClient`](IdentityProfileClient.md)

Create a new instance of IdentityClient.

#### Parameters

• **config**: `IBaseRestClientConfig`

The configuration for the client.

#### Returns

[`IdentityProfileClient`](IdentityProfileClient.md)

#### Overrides

`BaseRestClient.constructor`

## Properties

### CLASS\_NAME

> `readonly` **CLASS\_NAME**: `string`

Runtime name for the class.

#### Implementation of

`IIdentityProfileComponent.CLASS_NAME`

## Methods

### getEndpointWithPrefix()

> **getEndpointWithPrefix**(): `string`

Get the endpoint with the prefix for the namespace.

#### Returns

`string`

The endpoint with namespace prefix attached.

#### Inherited from

`BaseRestClient.getEndpointWithPrefix`

***

### fetch()

> **fetch**\<`T`, `U`\>(`route`, `method`, `request`?): `Promise`\<`U`\>

Perform a request in json format.

#### Type parameters

• **T** *extends* `IHttpRequest`\<`any`\>

• **U** *extends* `IHttpResponse`\<`any`\>

#### Parameters

• **route**: `string`

The route of the request.

• **method**: `HttpMethod`

The http method.

• **request?**: `T`

Request to send to the endpoint.

#### Returns

`Promise`\<`U`\>

The response.

#### Inherited from

`BaseRestClient.fetch`

***

### create()

> **create**(`publicProfile`?, `privateProfile`?): `Promise`\<`void`\>

Create the profile properties for an identity.

#### Parameters

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`IIdentityProfileComponent.create`

***

### get()

> **get**(`publicPropertyNames`?, `privatePropertyNames`?): `Promise`\<`object`\>

Get the profile properties for an identity.

#### Parameters

• **publicPropertyNames?**: `string`[]

The public properties to get for the profile, defaults to all.

• **privatePropertyNames?**: `string`[]

The private properties to get for the profile, defaults to all.

#### Returns

`Promise`\<`object`\>

The identity and the items properties.

##### identity

> **identity**: `string`

##### publicProfile?

> `optional` **publicProfile**: `unknown`

##### privateProfile?

> `optional` **privateProfile**: `unknown`

#### Implementation of

`IIdentityProfileComponent.get`

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

#### Implementation of

`IIdentityProfileComponent.getPublic`

***

### update()

> **update**(`publicProfile`?, `privateProfile`?): `Promise`\<`void`\>

Update the profile properties of an identity.

#### Parameters

• **publicProfile?**: `unknown`

The public profile data as JSON-LD.

• **privateProfile?**: `unknown`

The private profile data as JSON-LD.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`IIdentityProfileComponent.update`

***

### remove()

> **remove**(): `Promise`\<`void`\>

Delete the profile for an identity.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Implementation of

`IIdentityProfileComponent.remove`

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

#### Implementation of

`IIdentityProfileComponent.list`

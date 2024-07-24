# Class: IdentityService

Class which implements the identity contract.

## Implements

- `IIdentity`

## Constructors

### new IdentityService()

> **new IdentityService**(`config`?): [`IdentityService`](IdentityService.md)

Create a new instance of IdentityService.

#### Parameters

• **config?**: [`IIdentityServiceConfig`](../interfaces/IIdentityServiceConfig.md)

The configuration for the service.

#### Returns

[`IdentityService`](IdentityService.md)

## Properties

### CLASS\_NAME

> `readonly` **CLASS\_NAME**: `string`

Runtime name for the class.

#### Implementation of

`IIdentity.CLASS_NAME`

## Methods

### create()

> **create**(`controller`, `options`?, `requestContext`?): `Promise`\<`object`\>

Create a new identity.

#### Parameters

• **controller**: `string`

The controller for the identity.

• **options?**

Additional options for the identity service.

• **options.namespace?**: `string`

The namespace of the connector to use for the identity, defaults to service configured namespace.

• **requestContext?**: `IServiceRequestContext`

The context for the request.

#### Returns

`Promise`\<`object`\>

The created identity details.

##### identity

> **identity**: `string`

The identity created.

#### Implementation of

`IIdentity.create`

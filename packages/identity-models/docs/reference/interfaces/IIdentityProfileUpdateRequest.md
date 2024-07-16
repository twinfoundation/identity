# Interface: IIdentityProfileUpdateRequest

Request to update an identity profile.

## Properties

### pathParams?

> `optional` **pathParams**: `object`

The path parameters.

#### identity

> **identity**: `string`

The identity to update the profile for.

***

### body

> **body**: `object`

The data for the request.

#### properties

> **properties**: [`IIdentityProfileProperty`](IIdentityProfileProperty.md)[]

Properties for the identity.

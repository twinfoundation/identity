# Interface: IIdentityProfileGetResponse

Response to get an identity details.

## Properties

### body

> **body**: `object`

The response payload.

#### identity

> **identity**: `string`

The identity of the profile, this is the authenticated user identity.

#### publicProfile?

> `optional` **publicProfile**: `Partial`\<`IJsonLdDocument`\>

The public profile data.

#### privateProfile?

> `optional` **privateProfile**: `Partial`\<`IJsonLdDocument`\>

The private profile data.

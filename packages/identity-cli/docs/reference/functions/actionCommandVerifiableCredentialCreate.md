# Function: actionCommandVerifiableCredentialCreate()

> **actionCommandVerifiableCredentialCreate**(`opts`): `Promise`\<`void`\>

Action the verifiable credential create command.

## Parameters

• **opts**

The options for the command.

• **opts.id**: `string`

The id of the verification method to use for the credential.

• **opts.privateKey**: `string`

The private key for the verification method.

• **opts.credentialId?**: `string`

The id of the credential.

• **opts.types?**: `string`[]

The types for the credential.

• **opts.subjectJson**: `string`

The JSON data for the subject.

• **opts.contexts?**: `string`[]

The contexts for the credential.

• **opts.revocationIndex?**: `string`

The revocation index for the credential.

• **opts.console**: `boolean`

Flag to display on the console.

• **opts.json?**: `string`

Output the data to a JSON file.

• **opts.mergeJson**: `boolean`

Merge the data to a JSON file.

• **opts.env?**: `string`

Output the data to an environment file.

• **opts.mergeEnv**: `boolean`

Merge the data to an environment file.

• **opts.node**: `string`

The node URL.

## Returns

`Promise`\<`void`\>

# Function: actionCommandVerificationMethodAdd()

> **actionCommandVerificationMethodAdd**(`opts`): `Promise`\<`void`\>

Action the verification method add command.

## Parameters

• **opts**

The options for the command.

• **opts.seed**: `string`

The private key for the controller.

• **opts.did**: `string`

The identity of the document to add to.

• **opts.type**: `DidVerificationMethodType`

The type of the verification method to add.

• **opts.id?**: `string`

The id of the verification method to add.

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

• **opts.explorer**: `string`

The explorer URL.

## Returns

`Promise`\<`void`\>

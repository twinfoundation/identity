# Function: actionCommandProofCreate()

> **actionCommandProofCreate**(`opts`): `Promise`\<`void`\>

Action the proof create command.

## Parameters

• **opts**

The options for the command.

• **opts.id**: `string`

The id of the verification method to use for the credential.

• **opts.privateKey**: `string`

The private key for the verification method.

• **opts.data**: `string`

The data to create the proof for.

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

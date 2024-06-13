# Function: actionCommandProofVerify()

> **actionCommandProofVerify**(`opts`): `Promise`\<`void`\>

Action the proof verify command.

## Parameters

• **opts**

The options for the command.

• **opts.id**: `string`

The id of the verification method to use for the credential.

• **opts.data**: `string`

The data to verify the proof for.

• **opts.type**: `string`

The type of the proof.

• **opts.value**: `string`

The proof value.

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

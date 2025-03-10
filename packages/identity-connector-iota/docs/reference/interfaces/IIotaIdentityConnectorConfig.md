# Interface: IIotaIdentityConnectorConfig

Configuration for the IOTA Identity Connector.

## Extends

- `IIotaConfig`

## Extended by

- [`IIotaIdentityResolverConnectorConfig`](IIotaIdentityResolverConnectorConfig.md)

## Properties

### walletAddressIndex?

> `optional` **walletAddressIndex**: `number`

The wallet address index to use for funding and controlling the identity.

#### Default

```ts
0
```

***

### identityPkgId?

> `optional` **identityPkgId**: `string`

The package ID for the identity contract on the network.

***

### gasBudget?

> `optional` **gasBudget**: `bigint`

The gas budget for the identity contract on the network.

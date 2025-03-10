# Interface: IIotaIdentityConnectorConstructorOptions

Options for the IOTA Identity Connector constructor.

## Properties

### vaultConnectorType?

> `optional` **vaultConnectorType**: `string`

The vault connector type for the private keys.

#### Default

```ts
vault
```

***

### walletConnectorType?

> `optional` **walletConnectorType**: `string`

The wallet connector.

#### Default

```ts
wallet
```

***

### config

> **config**: [`IIotaIdentityConnectorConfig`](IIotaIdentityConnectorConfig.md)

The configuration for the identity connector.

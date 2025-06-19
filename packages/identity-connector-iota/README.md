# TWIN Identity Connector IOTA

Identity connector implementation using IOTA.

## Installation

```shell
npm install @twin.org/identity-connector-iota
```

## Testing

The tests developed are functional tests and need instances of the IOTA Gas Station, Redis, and Universal Resolver up and running. To run these services locally using Docker:

### Prerequisites

Before running the tests, you need to set up the required services:

1. **Redis** - Used for gas station storage
2. **IOTA Gas Station** - Required for gas reservation and transaction execution with identity operations
3. **Universal Resolver** - Required for DID resolution in identity tests

### Option 1: Standalone Docker Images (Recommended)

The simplest way to set up the testing environment using pre-built Docker images:

```shell
# Pull the required Docker images
docker pull redis:7-alpine
docker pull iotaledger/gas-station:latest
docker pull iotaledger/uni-resolver-driver-iota:v0.2.0-alpha

# Start Redis
docker run -d --name identity-redis -p 6379:6379 redis:7-alpine

# Start Universal Resolver for Identity testing
docker run -d --name universal-resolver -p 8080:8080 -e NETWORK=testnet iotaledger/uni-resolver-driver-iota:v0.2.0-alpha

# Create gas station config file
cat > gas-station-config.yaml << EOF
signer-config:
  local:
    keypair: AKT1Ghtd+yNbI9fFCQin3FpiGx8xoUdJMe7iAhoFUm4f
rpc-host-ip: 0.0.0.0
rpc-port: 9527
metrics-port: 9184
storage-config:
  redis:
    redis_url: "redis://127.0.0.1:6379"
fullnode-url: "https://api.testnet.iota.cafe"
coin-init-config:
  target-init-balance: 100000000
  refresh-interval-sec: 86400
daily-gas-usage-cap: 1500000000000
access-controller:
  access-policy: disabled
EOF

# Start IOTA Gas Station
docker run -d --name gas-station \
  -p 9527:9527 -p 9184:9184 \
  -v $(pwd)/gas-station-config.yaml:/config/config.yaml \
  --network host \
  -e GAS_STATION_AUTH=qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI= \
  iotaledger/gas-station:latest \
  --config-path /config/config.yaml
```

### Option 2: Docker Compose (Requires Gas Station Repository)

If you have the IOTA gas station repository cloned locally:

```shell
# Clone the gas station repository (if you don't have it)
git clone https://github.com/iotaledger/gas-station.git

# Start Universal Resolver for Identity testing
docker run -d --name universal-resolver -p 8080:8080 -e NETWORK=testnet iotaledger/uni-resolver-driver-iota:v0.2.0-alpha

# Navigate to the gas station docker directory
cd gas-station/docker

# Generate a config file for testnet (this creates config.yaml)
../target/debug/tool generate-sample-config --docker-compose --config-path config.yaml --network testnet

# Set the authentication token and start services (Redis + Gas Station)
GAS_STATION_AUTH=qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI= docker-compose up -d

# Return to the Identity package directory to run tests
cd ../../packages/identity-connector-iota
```

### Environment Variables

The tests require the following environment variables to be set:

```shell
# Required for all tests
export TEST_MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
export TEST_NODE_ENDPOINT="https://api.testnet.iota.cafe"
export TEST_FAUCET_ENDPOINT="https://faucet.testnet.iota.cafe/gas"
export TEST_NETWORK="testnet"

# Required for gas station integration tests
export GAS_STATION_URL="http://localhost:9527"
export GAS_STATION_AUTH_TOKEN="qEyCL6d9BKKFl/tfDGAKeGFkhUlf7FkqiGV7Xw4JUsI="

# Optional for Universal Resolver tests
export UNIVERSAL_RESOLVER_URL="http://localhost:8080"
```

### Running Tests

After the services are running and environment variables are set, you can execute the tests:

```shell
npm run test
```

To stop the services when finished:

```shell
# If using Option 1 (Standalone Docker Images)
docker stop identity-redis gas-station universal-resolver
docker rm identity-redis gas-station universal-resolver

# If using Option 2 (Docker Compose from gas-station/docker directory)
cd gas-station/docker && docker-compose down
docker stop universal-resolver && docker rm universal-resolver
```

## Examples

Usage of the APIs is shown in the examples [docs/examples.md](docs/examples.md)

## Reference

Detailed reference documentation for the API can be found in [docs/reference/index.md](docs/reference/index.md)

## Changelog

The changes between each version can be found in [docs/changelog.md](docs/changelog.md)

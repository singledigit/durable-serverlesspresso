# Layer Management

## Overview

The durable execution SDKs are NOT available on npm. They only exist in `/tmp/aws-durable-execution-sdk-js`.

This Makefile ensures SAM gets **exactly what it needs** and nothing else.

## Usage

### Prep layers for SAM
```bash
make layers
```

This will:
1. Build the SDKs in `/tmp` (if not already built)
2. Copy ONLY the built artifacts to `src/durable-sdk/` and `src/durable-client/`
3. Create minimal `package.json` files (no devDependencies)
4. Create Makefiles for SAM to use

### Then build with SAM
```bash
sam build
```

SAM will use the prepped layer directories and cache them. If layers haven't changed, SAM uses the cache.

### Clean layers
```bash
make clean-layers
```

Removes all layer prep files. Run `make layers` again to rebuild.

## What Gets Copied

### DurableSdkLayer (`src/durable-sdk/`)
- `dist/` - ESM build
- `dist-cjs/` - CommonJS build  
- `dist-types/` - TypeScript definitions
- `package.json` - Minimal (no devDependencies)
- `Makefile` - For SAM to build the layer

### DurableClientLayer (`src/durable-client/`)
- `client-lambda/` - Complete client SDK
- `Makefile` - For SAM to build the layer

## Why This Approach?

1. **No dependency pollution** - Only built artifacts, no monorepo cruft
2. **SAM caching works** - Layers only rebuild when changed
3. **Clean separation** - Build SDKs once, use everywhere
4. **No npm issues** - SDKs aren't published, so we copy from source

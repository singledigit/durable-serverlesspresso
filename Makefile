.PHONY: layers clean-layers build-sdks durable-sdk-layer durable-client-layer

# Source paths
SDK_SOURCE = /tmp/aws-durable-execution-sdk-js/packages/aws-durable-execution-sdk-js
CLIENT_SOURCE = /tmp/aws-durable-execution-sdk-js/packages/client-lambda

# Target paths
SDK_TARGET = src/durable-sdk
CLIENT_TARGET = src/durable-client

layers: clean-layers build-sdks durable-sdk-layer durable-client-layer
	@echo "✓ Layers prepared for SAM build"

build-sdks:
	@echo "Building SDKs in /tmp..."
	@cd /tmp/aws-durable-execution-sdk-js && npm install --ignore-scripts
	@cd $(SDK_SOURCE) && npm run build:esm && npm run build:cjs && npm run build:types
	@echo "✓ SDKs built"

durable-sdk-layer:
	@echo "Preparing durable-sdk layer..."
	@rm -rf $(SDK_TARGET)
	@mkdir -p $(SDK_TARGET)
	@# Copy only built artifacts
	@cp -r $(SDK_SOURCE)/dist $(SDK_TARGET)/
	@cp -r $(SDK_SOURCE)/dist-cjs $(SDK_TARGET)/
	@cp -r $(SDK_SOURCE)/dist-types $(SDK_TARGET)/
	@# Create minimal package.json (support both ESM and CJS)
	@printf '{\n  "name": "aws-durable-execution-sdk-js",\n  "version": "0.1.0",\n  "main": "./dist-cjs/index.js",\n  "module": "./index.mjs",\n  "types": "./dist-types/index.d.ts",\n  "exports": {\n    ".": {\n      "types": "./dist-types/index.d.ts",\n      "import": "./index.mjs",\n      "require": "./dist-cjs/index.js"\n    }\n  }\n}\n' > $(SDK_TARGET)/package.json
	@# Keep the Makefile for SAM
	@printf 'build-DurableSdkLayer:\n\tmkdir -p $$(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js\n\tcp -r dist/* $$(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/ 2>/dev/null || true\n\tcp -r dist-cjs $$(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/\n\tcp -r dist-types $$(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/\n\tcp package.json $$(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/\n' > $(SDK_TARGET)/Makefile
	@echo "✓ durable-sdk layer ready"

durable-client-layer:
	@echo "Preparing durable-client layer..."
	@rm -rf $(CLIENT_TARGET)
	@mkdir -p $(CLIENT_TARGET)
	@# Copy entire client-lambda directory (it's already built)
	@cp -r $(CLIENT_SOURCE) $(CLIENT_TARGET)/
	@# Install dependencies
	@cd $(CLIENT_TARGET)/client-lambda && npm install --production --ignore-scripts
	@# Keep the Makefile for SAM
	@printf 'build-DurableClientLayer:\n\tmkdir -p $$(ARTIFACTS_DIR)/nodejs/node_modules/@aws-sdk\n\tcp -r client-lambda $$(ARTIFACTS_DIR)/nodejs/node_modules/@aws-sdk/\n' > $(CLIENT_TARGET)/Makefile
	@echo "✓ durable-client layer ready"

clean-layers:
	@echo "Cleaning layer directories..."
	@rm -rf $(SDK_TARGET)/*
	@rm -rf $(CLIENT_TARGET)/*
	@echo "✓ Layer directories cleaned"

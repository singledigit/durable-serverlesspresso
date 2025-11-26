build-DurableSdkLayer:
	mkdir -p $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js
	cp -r dist/* $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/ 2>/dev/null || true
	cp -r dist-cjs $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/
	cp -r dist-types $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/
	cp package.json $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/

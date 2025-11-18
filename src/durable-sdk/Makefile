build-DurableSdkLayer:
	mkdir -p $(ARTIFACTS_DIR)/nodejs/node_modules
	cp -r sdk-package $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js
	cp -r node_modules/* $(ARTIFACTS_DIR)/nodejs/node_modules/
	rm -rf $(ARTIFACTS_DIR)/nodejs/node_modules/aws-durable-execution-sdk-js/node_modules

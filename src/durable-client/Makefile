build-DurableClientLayer:
	mkdir -p $(ARTIFACTS_DIR)/nodejs/node_modules/@aws-sdk
	cp -r client-lambda $(ARTIFACTS_DIR)/nodejs/node_modules/@aws-sdk/
	cp -r node_modules/* $(ARTIFACTS_DIR)/nodejs/node_modules/
	rm -rf $(ARTIFACTS_DIR)/nodejs/node_modules/@aws-sdk/client-lambda/node_modules

FABRIC_ROOT_DIR=fabric-network
CC_LANG=node
CC_VERSION=$(shell date +"%y.%m.%d.%H%M%S")
CC_SRC_PATH=/opt/gopath/src/github.com/chaincode
DOCKER_CRYPTO_DIR=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
CHANNEL_NAME=mychannel

clean-docker:
	docker rm $(shell docker ps -a -q) | true && \
	docker rmi $(shell docker images -q)

fabric-init-crypto:
	rm -fr $(FABRIC_ROOT_DIR)/config/*
	rm -fr $(FABRIC_ROOT_DIR)/crypto-config/*

	# generate crypto material
	cd $(FABRIC_ROOT_DIR) && ./bin/cryptogen generate \
		--config=./crypto-config.yaml

	# generate genesis block for orderer
	cd $(FABRIC_ROOT_DIR) && ./bin/configtxgen \
		-profile OneOrgOrdererGenesis \
		-outputBlock ./config/genesis.block

	# generate channel configuration transaction
	cd $(FABRIC_ROOT_DIR) && ./bin/configtxgen \
		-profile OneOrgChannel \
		-outputCreateChannelTx ./config/channel.tx \
		-channelID $(CHANNEL_NAME)
commented-out:
	# generate anchor peer transaction
	cd $(FABRIC_ROOT_DIR) && ./bin/configtxgen \
		-profile OneOrgChannel \
		-outputAnchorPeersUpdate ./config/Org1MSPanchors.tx \
		-channelID $(CHANNEL_NAME) \
		-asOrg Org1MSP




fabric-start-network:
	cd $(FABRIC_ROOT_DIR) && \
	docker-compose -f docker-compose.yml down | true && \
	docker rm $(shell docker ps -a -q) | true && \
	docker-compose -f docker-compose.yml up 

	# Close on Control+C
	docker-compose -f docker-compose.yml down


fabric-install-chaincode:
	# Create channel
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		peer0.org1.example.com peer channel create \
		-o orderer.example.com:7050 \
		-c mychannel \
		-f /etc/hyperledger/configtx/channel.tx \
		| true

    	# Join peer0.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		peer0.org1.example.com peer channel join \
		-b mychannel.block \
		| true 

    	# Join peer1.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		-e "CORE_PEER_ADDRESS=peer1.org1.example.com:7051" \
		peer0.org1.example.com peer channel join -b mychannel.block 

    	# Join peer2.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		-e "CORE_PEER_ADDRESS=peer2.org1.example.com:7051" \
		peer0.org1.example.com peer channel join -b mychannel.block 
    	
	# Join peer3.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		-e "CORE_PEER_ADDRESS=peer3.org1.example.com:7051" \
		peer0.org1.example.com peer channel join -b mychannel.block 

    	# Join peer4.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		-e "CORE_PEER_ADDRESS=peer4.org1.example.com:7051" \
		peer0.org1.example.com peer channel join -b mychannel.block 

	# Install the chaincode on the peers
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=$(DOCKER_CRYPTO_DIR)" \
		cli peer chaincode install \
		-n mycc \
		-v $(CC_VERSION)  \
		-p "$(CC_SRC_PATH)" \
		-l "$(CC_LANG)"

	# Instantiate chaincode
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=$(DOCKER_CRYPTO_DIR)" \
		cli peer chaincode instantiate \
		-o orderer.example.com:7050 \
		-C mychannel \
		-n mycc \
		-l "$(CC_LANG)" \
		-v $(CC_VERSION) \
		-c '{"Args":[""]}'



fabric-upgrade-chaincode:
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=$(DOCKER_CRYPTO_DIR)" \
		cli peer chaincode install \
		-n mycc \
		-v $(CC_VERSION) \
		-p "$(CC_SRC_PATH)" \
		-l "$(CC_LANG)"

	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=$(DOCKER_CRYPTO_DIR)" \
		cli peer chaincode upgrade \
		-o orderer.example.com:7050 \
		-C mychannel \
		-n mycc \
		-l "$(CC_LANG)" \
		-v $(CC_VERSION) \
		-c '{"Args":[""]}'

fabric-invoke-chaincode:
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
    	-e "CORE_PEER_MSPCONFIGPATH=$(DOCKER_CRYPTO_DIR)" \
		cli peer chaincode invoke \
		-o orderer.example.com:7050 \
		-C $(CHANNEL_NAME) \
		-n mycc \
		--peerAddresses peer0.org1.example.com:7051 \
		-c '{"Args":["setCitizen","123","James","Delft", "Street 5"]}'

start-rest:
	echo "todo"

start-cjib-app:
	echo "Start CJIB app"

start-municipalities-app:
	echo "Start Municipality app"

fabric-join-peer0:
	# Create channel
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		peer0.org1.example.com peer channel create \
		-o orderer.example.com:7050 \
		-c mychannel \
		-f /etc/hyperledger/configtx/channel.tx \
		| true

    	# Join peer0.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		peer0.org1.example.com peer channel join \
		-b mychannel.block \
		| true 

fabric-join-peer1:
    	# Join peer1.org1.example.com to the channel.
	docker exec \
		-e "CORE_PEER_LOCALMSPID=Org1MSP" \
		-e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@org1.example.com/msp" \
		-e "CORE_PEER_ADDRESS=peer1.org1.example.com:7051" \
		peer0.org1.example.com peer channel join -b mychannel.block 

#create-card:
#	cd fabric-composer-project && \
#	composer card create -n network-name \
#	-p connection-profile.file \
#	-u user-name \
#	-c certificate \
#	-k private-key \
#	-r role-1(PeerAdmin) \
#	-r role-2 (ChannelAdmin) \
#	-f file-name
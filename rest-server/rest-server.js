const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const config = require('./config/environment');
const jwt = require('jwt-simple');
const passport = require('passport');
const java = require('java');
java.classpath.push('zkrp.jar');

const port = 8080;

const CJIB_ROLE = 0;
const MUN_ROLE = 1;

require('./config/passport')(passport);

// Use the passport package in our application
app.use(passport.initialize());

// get request params
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// log to console
app.use(morgan('dev'));

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Authorization, Content-Type, Accept");
    next();
});

const Fabric_Client = require('fabric-client');
const path = require('path');
const util = require('util');
const db = require('./config/db-config');
const User = db.user;

const fabric_client = new Fabric_Client();
const channel = fabric_client.newChannel('mychannel');
const peer = fabric_client.newPeer('grpc://localhost:7051');
channel.addPeer(peer);
const order = fabric_client.newOrderer('grpc://localhost:7050');
channel.addOrderer(order);

const channel_event_hub = channel.newChannelEventHub(peer.getName());

const store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:' + store_path);

function invoke(params, next) {
    let tx_id = null;
    let member_user = null;

    return Fabric_Client.newDefaultKeyValueStore({
        path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        fabric_client.setStateStore(state_store);
        const crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        const crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('admin', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded admin from persistence');
            member_user = user_from_store;
            channel_event_hub.connect();
        } else {
            throw new Error('Failed to get admin.... run registerAdmin.js');
        }

        // get a transaction id object based on the current user assigned to fabric client
        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction_id: ", tx_id._transaction_id);

        params.txId = tx_id;

        // send the transaction proposal to the peers
        return Promise.all([channel.sendTransactionProposal(params), tx_id._transaction_id]);
    }).then((results) => {
        const proposalResponses = results[0][0];
        const proposal = results[0][1];
        const txId = results[1];

        let isProposalGood = false;

        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
        } else {
            throw new Error(proposalResponses[0].message);
        }
        if (isProposalGood) {
            console.log(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));

            // build up the request for the orderer to have the transaction committed
            const request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            const sendPromise = channel.sendTransaction(request);

            console.log('Channel eventhub is connected: ' + channel_event_hub.isconnected());

            let event_monitor = new Promise((resolve, reject) => {
                let handle = setTimeout(() => {
                    channel_event_hub.unregisterTxEvent(txId);
                    reject(new Error('Timeout - Failed to receive the transaction event with txId ' + txId));
                }, 20000);

                channel_event_hub.registerTxEvent(txId,
                    (trasactionId, status, blockNumber) => {
                        clearTimeout(handle);
                        resolve([status, blockNumber]);
                    },
                    (error) => {
                        reject(new Error('Failed to receive the transaction event ::' + error))
                    },
                    {disconnect: true}
                );
            });

            return Promise.all([sendPromise, event_monitor]);
        } else {
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        // check the results in the order the promises were added to the promise all list
        if (results && results[0] && results[0].status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            throw new Error('Failed to order the transaction.')
        }
        if (results && results[1] && results[1][0] === 'VALID') {
            console.log('Successfully committed the change to the ledger by the peer, with block number ' + results[1][1]);
        } else {
            throw new Error('Transaction failed to be committed to the ledger due to :: ' + results[1]);
        }
    }).catch(next);
}

function query(params, next) {
    let member_user = null;

    return Fabric_Client.newDefaultKeyValueStore({
        path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        fabric_client.setStateStore(state_store);
        const crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        const crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('admin', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get admin.... run registerAdmin.js');
        }

        // send the query proposal to the peer
        return channel.queryByChaincode(params);
    }).then((query_responses) => {
        console.log("Query has completed, checking results");
        // query_responses could have more than one  results if there multiple peers were used as targets
        if (query_responses && query_responses.length === 1) {
            if (query_responses[0] instanceof Error) {
                throw query_responses[0];
            } else {
                console.log("Response is ", query_responses[0].toString());
                return query_responses[0];
            }
        } else {
            console.log("No payloads were returned from query");
        }
    }).catch(next);
}

const router = express.Router();
router.use(function (req, res, next) {
    console.log('Received ' + req.method + ' request at ' + req.url);
    next();
})
    // [GET] get citizen info based on the passed params
    .get('/getCitizen', passport.authenticate('jwt', {session: false}), function (req, res, next) {
        var token = getToken(req.headers);
        if (token) {
            // Authorization token was provided
            var decoded = jwt.decode(token, config.secret);

            // Need this since both MUN & CJIB employees are stored in the same db
            if (decoded.role !== CJIB_ROLE) {
                res.status(403).json({success: false, msg: 'Authentication failed. User role has no access.'});
            } else {
                User.findOne({ where: {username: decoded.username} 
                }).then(user => {
                    if (!user) {
                        res.status(403).json({success: false, msg: 'Authentication failed. User not found.'});
                    } else {
                        let requestBsn = req.query.bsn;
                        let requestMonths = req.query.months;
    
                        let params = [requestBsn];
                        if (requestMonths) {
                            params.push(requestMonths);
                        }

                        // query the chaincode
                        query({
                            chaincodeId: 'mycc',
                            fcn: 'getCitizenCJIB',
                            args: params
                        }).then(fetchedCitizen => {
                            let citizenInfo = JSON.parse(fetchedCitizen.toString());
                            res.json(citizenInfo);
                        }).catch(next);
                    }
                })
            }
        } else {
            // Authorization token was not provided
            return res.status(403).send({success: false, msg: 'No token provided.'});
        }
    })

    // [POST] authenticate user
    .post('/authenticate', function (req, res) {
        var username = req.body.name;
        var password = req.body.password;

        User.findOne({ where: {username: username} 
        }).then(user => {
            if (!user) {
                res.status(404).json({success: false, msg: 'Authentication failed. User not found.'});
            } else {
                // check if password matches
                user.comparePassword(password, function (err, isMatch) {
                    if (isMatch && !err) {
                        // creates a token if the user is found and the password is right 
                        var token = jwt.encode(user, config.secret);
                        // return the information including token as JSON
                        res.json({success: true, token: 'JWT ' + token});
                    } else {
                        res.status(400).send({success: false, msg: 'Authentication failed. Wrong password.'});
                    }
                });
            }
        }).catch(err => {
            res.status(500).json({msg: "error", details: err});
        });
    })

    // [POST] create citizen info
    .post('/createCitizen', passport.authenticate('jwt', {session: false}), function (req, res, next) {
        var token = getToken(req.headers);
        if (token) {
            // Authorization token was provided
            var decoded = jwt.decode(token, config.secret);

            // Need this since both MUN & CJIB employees are stored in the same db
            if (decoded.role !== MUN_ROLE) {
                res.status(403).json({success: false, msg: 'Authentication failed. User role has no access.'});
            } else {
                User.findOne({ where: {username: decoded.username} 
                }).then(user => {
                    if (!user) {
                        res.status(403).json({success: false, msg: 'Authentication failed. User not found.'});
                    } else {
                        invoke({
                            chaincodeId: 'mycc',
                            fcn: 'setCitizen',
                            args: [
                                req.body.bsn,
                                req.body.firstName,
                                req.body.lastName,
                                req.body.address,
                                req.body.financialSupport,
                                req.body.fineAmount,
                                req.body.consent,
                                req.body.municipalityId
                            ]
                        }).then(() => {
                            res.json({'status': 'success'})
                        }).catch(next);
                    }
                }).catch(err => {
                    res.status(500).json({msg: "error", details: err});
                });
            }
        } else {
            // Authorization token was not provided
            return res.status(403).send({success: false, msg: 'No token provided.'});
        }
    })

    // [PUT] update citizen info
    .put('/updateCitizen', passport.authenticate('jwt', {session: false}), function (req, res, next) {
        var token = getToken(req.headers);
        if (token) {
            // Authorization token was provided
            var decoded = jwt.decode(token, config.secret);

            // Need this since both MUN & CJIB employees are stored in the same db
            if (decoded.role !== MUN_ROLE) {
                res.status(403).json({success: false, msg: 'Authentication failed. User role has no access.'});
            } else {
                User.findOne({ where: {username: decoded.username} 
                }).then(user => {
                    if (!user) {
                        res.status(403).json({success: false, msg: 'Authentication failed. User not found.'});
                    } else {
                        invoke({
                            chaincodeId: 'mycc',
                            fcn: 'updateCitizen',
                            args: [
                                req.body.bsn,
                                req.body.financialSupport,
                            ]
                        }).then(() => {
                            res.json({'status': 'success'})
                        }).catch(next);
                    }
                }).catch(err => {
                    res.status(500).json({msg: "error", details: err});
                });
            }
        } else {
            // Authorization token was not provided
            return res.status(403).send({success: false, msg: 'No token provided.'});
        }
    })

    // [DELETE] delete citizen info
    .delete('/deleteCitizen', passport.authenticate('jwt', {session: false}), function (req, res, next) {
        var token = getToken(req.headers);
        if (token) {
            // Authorization token was provided
            var decoded = jwt.decode(token, config.secret);

            // Need this since both MUN & CJIB employees are stored in the same db
            if (decoded.role !== MUN_ROLE) {
                res.status(403).json({success: false, msg: 'Authentication failed. User role has no access.'});
            } else {
                User.findOne({ where: {username: decoded.username} 
                }).then(user => {
                    if (!user) {
                        res.status(403).json({success: false, msg: 'Authentication failed. User not found.'});
                    } else {
                        invoke({
                            chaincodeId: 'mycc',
                            fcn: 'deleteCitizen',
                            args: [
                                req.body.bsn
                            ]
                        }).then(() => {
                            res.json({'status': 'success'})
                        }).catch(next);
                    }
                }).catch(err => {
                    res.status(500).json({msg: "error", details: err});
                });
            }
        } else {
            // Authorization token was not provided
            return res.status(403).send({success: false, msg: 'No token provided.'});
        }
    })
    .post('/verifyProof', function (req, res, next) {
        const commitment = JSON.stringify({'commitment': req.body.commitment});
        const range = JSON.stringify({'range': req.body.range});
        const proof = JSON.stringify({'proof': req.body.proof});

        const answer = java.callStaticMethodSync('com.ing.blockchain.zk.JavaScriptRangeProof', 'verify', proof, commitment, range);

        return res.status(200).send({answer: answer})
    });

getToken = function (headers) {
    if (headers && headers.authorization) {
        var parted = headers.authorization.split(' ');
        if (parted.length === 2) {
            return parted[1];
        } else {
            return null;
        }
    } else {
        return null;
    }
};

app.use('/api', router);

function getError(message) {
    if (message.startsWith('transaction returned with failure: Error 404:')) {
        return 404
    } else {
        return 500
    }
}

app.use(function (err, req, res, next) {
    res.status(getError(err.message)).send({
        'message': err.message
    })
});

const server = app.listen(port, function () {
    const port = server.address().port;
    console.log("Listening at http://localhost:%s", port)
});

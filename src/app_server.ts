


let threadManager = require("./selftyped/Thread").manager;
import {ThreadT} from "./types/ThreadT";

let processName = "base_service";

// main thread
let mainThread:ThreadT = threadManager.get(processName);

mainThread.console.bold("");
mainThread.console.bold("*****************");
mainThread.console.bold("*               *");
mainThread.console.bold("*  LLM SERVICE  *");
mainThread.console.bold("*               *");
mainThread.console.bold("*****************");

let uuid = require('uuid');
require('source-map-support').install();  // stack trace gives us accurate TS line numbers
//require('https').globalActor.options.ca = require('ssl-root-cas/latest').create();
let WebSocketBase = require('ws')

import {UtilT} from "./types/UtilT";
let util:UtilT = require('./untyped/Util').singleton;

import {UnsafeBoardT} from "./types/UnsafeBoardT";
let UnsafeBoard = require('./untyped/UnsafeBoard').class;

import {PrettyT} from "./types/PrettyT";
let pretty:PrettyT = require('./untyped/Pretty').singleton;

import {UnsafeHelperT} from "./types/UnsafeHelperT";
let UnsafeHelper = require("./selftyped/UnsafeHelper").class;

import {ServerT} from "./types/ServerT";
let Server = require("./selftyped/Server").class;

import {WebsocketMapT} from "./common/Common";
import {WebsocketT} from "./common/Common";
import {ClientT} from "./common/Common";
import {ClientMapT} from "./common/Common";

import {PrintableContentT} from "./common/Common";
import {InspectObjectT} from "./types/InspectObjectT";
let InspectObject = require("./selftyped/InspectObject").class;

import {RequestT} from "./common/Common";
import {ReplyT} from "./common/Common";
import {LLMRequestT} from "./common/Common";
import {LLMRequestMapT} from "./common/Common";
import {MessageT} from "./common/Common";
import {MiniRequestT} from "./common/Common";


import {SockClient} from "./selftyped/SockClient";


process.on('unhandledRejection', function(err) {
    mainThread.console.softError("Unhandled promise rejection");
    mainThread.console.softError(err);
});

process.on('uncaughtException', function(err) {
    mainThread.console.softError("Unhandled exception");
    mainThread.console.softError(err);
});

process.on('SIGINT', () => {
    console.error('Got SIGINT signal; terminating process ' + process.pid);
    process.exit(0);
});

let PORTNUM = 3010   // both sockio and https
let PORTNUM_WEBSOCK = 3020 // base websocket for talking w browser extension

let run = async function() {

    let serverThread = threadManager.get(processName);
    let server:ServerT = new Server(serverThread);



    // for api connections
    server.setup = async function(
        thread:ThreadT,
        unsafeHelper:UnsafeHelperT,
        app: any,
        websockMap:WebsocketMapT) {

        let inspectThread = threadManager.get("inspect");
        let inspectObject:InspectObjectT = new InspectObject(inspectThread);

        let resultBoard:UnsafeBoardT = new UnsafeBoard(thread, null, {});
        let modelMap:ClientMapT = {};
        let connMap = {};

        type ConvoMapT = {
            [clientId:string]:number
        }
        let convoMap:ConvoMapT = {};

        // to browser
        type PayloadT = {
            mode: string,  // was called by either api or browser
            clientId: string,
            requestId: string,
            data: string
        }




        // browser extension connections (no socket.io to keep it simple)
        const wsServer = new WebSocketBase.Server({ port: PORTNUM_WEBSOCK });

        thread.console.info("Listening on port " + PORTNUM_WEBSOCK);

        // API connections
        server.onConnect = async function(websocket:WebsocketT) {

            websocket.on('request', async function(reqBuffer:string) {

                try {
                    //thread.console.bold("Received request from " + websocket._name);

                    let req:RequestT = unsafeHelper.extractUnsafeJSO(thread, reqBuffer, resultBoard);
                    //thread.console.debug("got request", req);

                    let reply:ReplyT = {
                        handle: req.handle,
                        data: null,
                        error: null
                    };


                    if (req.command === "loadTelemetry") {

                        Object.keys(modelMap).map(function(clientId) {
                            let client = modelMap[clientId];

                            let now = new Date();
                            let secondsSince = (now.getTime() - client.lastSeen.getTime())/1000;
                            if (secondsSince > 20) {
                                client.status = "BAD"
                            } else if (secondsSince > 10) {
                                client.status = "LATE"
                            } else {
                                client.status = "GOOD"
                            }

                        });



                        thread.console.info("model map", modelMap)
                        reply.data = modelMap;

                    } else if (req.command === "test") {
                        thread.console.debug("got request", req);

                        let clientInfo = req.data as MiniRequestT

                        let client = modelMap[clientInfo.clientId];

                        let conn = connMap[clientInfo.clientId];
                        if (conn) {
                            thread.console.info("Testing connection [" + clientInfo.clientId + "]")

                            let requestId = uuid.v4();

                            let payload:PayloadT = {
                                mode: "browser",
                                clientId: clientInfo.clientId,
                                requestId,
                                data: clientInfo.data
                            };

                            thread.console.debug("payload", payload)

                            let request = {
                                mode: "browser",
                                callback:   function() {
                                                thread.console.info("Callback for request " + requestId + " was triggered but no client side action registered")
                                            },
                                lastSeen: new Date(),
                                completion: ""
                            }
                            client.requestMap[requestId] = request;

                            thread.console.debug("request " + requestId, request)

                            conn.send(JSON.stringify(payload));

                        } else {
                            thread.console.warn("Unable to test connection [" + clientInfo.clientId + "]; not found")
                        }

                    } else {
                        reply.error = "Unrecognized command: " + req.command
                    }

                    let bufferOut = pretty.inspect(reply)
                    websocket.emit('reply', bufferOut)
                } catch (err) {
                    thread.console.softError("Request failed: " + err.toString());
                }

            });

        };





        let checkIdle = function() {
            //thread.console.info("Checking idle")

            //thread.console.debug("model map", modelMap)

            Object.keys(modelMap).map(function(clientId) {
                let client = modelMap[clientId];



                let requestMap:LLMRequestMapT = client.requestMap
                if (requestMap) {
                    Object.keys(requestMap).map(function(rid) {

                        let reqItem = requestMap[rid];

                        if (!reqItem["DEAD"]) {

                            thread.console.info("Checking idle for request " + rid)


                            // compute time elapsed
                            let now = new Date();
                            let milliElapsed = now.getTime() - reqItem.lastSeen.getTime()
                            reqItem["elapsed"] = milliElapsed

                            if (milliElapsed > 8000) {

                                thread.console.bold("Request " + rid + " idle for " + milliElapsed + "ms; assumed either done or dead")

                                // should have either error or data attribute set
                                if (reqItem.callback) {

                                    thread.console.warn("ASSIGNING DEAD TO " + rid)
                                    thread.console.debug("dead request", reqItem)

                                    reqItem["DEAD"] = true;
                                    reqItem.callback(clientId, rid);


                                } else {
                                    if (reqItem.mode === "browser") {
                                        // continue
                                    } else {
                                        thread.console.softError("API request " + rid + " lacks callback")
                                    }

                                    // just delete request when too old?
                                    //delete requestMap[rid]
                                }



                            } else {
                                thread.console.info("Request " + rid + " idle for " + milliElapsed + " ms")


                            }
                        } else {
                            //thread.console.info("Request " + rid + " already dead")
                        }



                    });
                }
            });
        }

        //needs to exceed normal update delay (see extension content.js)
        setInterval(checkIdle, 1000)

        wsServer.on('connection', conn => {
            thread.console.info("Extension connected");

            conn._client = null;

            conn.on('message', async function(buffer)  {

                try {

                    let message:MessageT = JSON.parse(buffer)


                    if (message.message === "announce") {

                        //thread.console.info(`Got extension client announce`);

                        let client = modelMap[message.clientId]
                        if (!client) {

                            client =  {
                                hostId: message.hostId,
                                clientId: message.clientId,
                                service: message.service,
                                model: message.model,
                                clientType: message.clientType,
                                lastSeen: new Date(),
                                status: "GOOD",
                                requestMap: {}
                            };

                            modelMap[message.clientId] = client;
                            conn._client = client;
                            connMap[message.clientId] = conn;
                        } else {
                            // update
                            client.service = message.service;
                            client.model = message.model
                            client.lastSeen = new Date()
                        }

                        // we don't broadcast but instead let client(s) refresh

                    } else if (message.message === "ping") {

                        thread.console.info(`Got ping`);

                        let client = modelMap[message.clientId]
                        if (client) {
                            // update
                            client.lastSeen = new Date()

                            if (!message.requestId) {
                                thread.console.softError("Ping lacks request id")
                            } else {

                                if (client.requestMap[message.requestId]) {
                                    thread.console.warn("Updated last seen for request " + message.requestId);
                                    client.requestMap[message.requestId].lastSeen = new Date();
                                } else {
                                    thread.console.softError("Request map does not have entry for ping reqeust " + message.requestId)
                                }
                            }

                        } else {
                            thread.console.softError("Client " + message.clientId + " not announced yet")
                        }


                    } else if (message.message === "terminated") {

                        delete modelMap[message.clientId];
                        delete connMap[message.clientId];

                    } else if (message.message === "snapshot") {

                        thread.console.info("Got snapshot")
                        thread.console.debug("snapshot", message);

                        // update idle
                        let client = modelMap[message.clientId];

                        if (client) {

                            client.service = message.service;
                            client.model = message.model
                            client.lastSeen = new Date()

                            if (!message.requestId) {
                                thread.console.softError("Snapshot lacks request id")
                            } else {

                                if (client.requestMap[message.requestId]) {
                                    thread.console.warn("Updated last seen for request " + message.requestId);
                                    client.requestMap[message.requestId].lastSeen = new Date();
                                    client.requestMap[message.requestId].completion += message.data;


                                    if (!client.requestMap[message.requestId].completion) {
                                        thread.console.softError("Snapshot completion failed")
                                        thread.console.debug("bad message", message)
                                    }


                                    thread.console.warn("snapshot request completion updated from message", client)
                                } else {
                                    thread.console.softError("Request map does not have entry for reqeust " + message.requestId)
                                }
                            }


                        } else {
                            thread.console.softError("Snapshot message pointing to invalid client: " + message.clientId)
                        }

                        // broadcast the snapshot so client can see activity
                        Object.keys(websockMap).map(function(name:string) {
                            thread.console.debug("Notifying " + name)

                            let websocket = websockMap[name];
                            if (!websocket._dead) {
                                websocket.emit('snapshot', message);
                            }

                        });

                    } else {
                        thread.console.softError("Unknown message received from client: " + message.message)
                    }


                } catch (err) {
                    thread.console.softError(err.toString())
                }
            })

            conn.on('close', () => {
                //thread.console.info("Extension client " + conn._client.clientId + " has disconnected");
                thread.console.info("Extension client has disconnected");

                let oldClient:ClientT = conn._client;

                if (oldClient) {
                    thread.console.debug("client", oldClient);

                    delete modelMap[oldClient.clientId];
                    delete connMap[oldClient.clientId];

                }
            })

        });

        app.post("/llm", async function(req, res) {
            let reqData = req.body as LLMRequestT;
            thread.console.debug("llm", reqData);

            let p = new Promise(function(resolve, reject) {

                let done = false;
                Object.keys(modelMap).map(function(clientId) {
                    if (done) {
                        return;
                    }

                    let client = modelMap[clientId];
                    if (client.service === reqData.service &&
                        client.model === reqData.model) {

                        // we have a match

                        let conn = connMap[client.clientId];
                        if (conn) {
                            thread.console.info("Sending request to connection [" + client.clientId + "]")

                            let requestMap:LLMRequestMapT = client.requestMap
                            if (!requestMap) {
                                requestMap = client["_requestMap"] = {};
                            }

                            let requestId = uuid.v4();

                            // create api request
                            let data = requestMap[requestId] = {
                                mode:       "api",
                                callback:   function(clientId, requestId) {
                                                resolve({clientId, requestId})
                                            },
                                lastSeen: new Date(),
                                completion: ""
                            }

                            thread.console.debug("request " + requestId, data);

                            let payload:PayloadT = {
                                mode: "api",
                                clientId: client.clientId,
                                requestId,
                                data: reqData.prompt
                            };

                            conn.send(JSON.stringify(payload));
                            done = true;
                        } else {
                            thread.console.warn("Skipping bad connection [" + client.clientId + "]")
                        }
                    }

                });

                if(!done) {
                    throw new Error("No eligible client [" + reqData.service + "." + reqData.model + "] found (is browser+extension running?)");
                }
            });

            try {
                let obj:any = await p

                let client = modelMap[obj.clientId]
                let request = client.requestMap[obj.requestId]

                let completion = request.completion;

                let samplePrompt = reqData.prompt.substring(0,10);
                if (completion.indexOf(samplePrompt) >= 0) {
                    // skip past prompt
                    completion = completion.substring( completion.indexOf(samplePrompt) + reqData.prompt.length)
                }

                completion = completion.trim();

                function removeLastChars(str, x) {
                    return str.slice(0, Math.max(0, str.length - x));
                }

                if (completion.startsWith("ChatGPT")) {
                    completion = completion.substring("ChatGPT".length)
                    completion = completion.trim();
                }

                // for langchain
                let resultObj = {
                    completion
                }


                thread.console.debug("Returning LLM API", resultObj)
                res.send(JSON.stringify(resultObj));
            } catch (err) {
                thread.console.softError(err.toString());
                res.send(JSON.stringify({error: err.toString()}));
            }


        });

        app.get("/", async function(req, res) {
            thread.console.info("Default route")
            res.redirect('/index.html');
        });


    }

    await server.run(PORTNUM, processName);
    server.runWebpack();

    mainThread.console.bold("LLM service ready");

};



try {
    run();

} catch (err) {
    mainThread.console.error(err);
}

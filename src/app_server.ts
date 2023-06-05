


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
let PORTNUM_WEBSOCK = 3020

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
        let requestMap = {};

        // browser extension connections (no socket.io to keep it simple)
        const wsServer = new WebSocketBase.Server({ port: PORTNUM_WEBSOCK });

        thread.console.info("Listening on port " + PORTNUM_WEBSOCK);

        // API connections
        server.onConnect = async function(websocket:WebsocketT) {

            websocket.on('request', async function(reqBuffer:string) {

                try {
                    //thread.console.bold("Received request from " + websocket._name);

                    let req:RequestT = unsafeHelper.extractUnsafeJSO(thread, reqBuffer, resultBoard);
                    //thread.console.debug("request", req);

                    let reply:ReplyT = {
                        handle: req.handle,
                        data: null,
                        error: null
                    };


                    if (req.command === "loadModelMap") {

                        //thread.console.info("model map", modelMap)
                        reply.data = modelMap;

                    } else if (req.command === "test") {

                        let clientInfo = req.data as ClientT;

                        let conn = connMap[clientInfo.clientId];
                        if (conn) {
                            thread.console.info("Testing connection [" + clientInfo.clientId + "]")

                            let payload = {
                                clientId: clientInfo.clientId,
                                data: clientInfo.data
                            };

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



        let lastSeenMap = {};

        wsServer.on('connection', conn => {
            thread.console.info("Extension connected");

            conn._client = null;

            conn.on('message', async function(buffer)  {

                try {

                    let client:ClientT = JSON.parse(buffer)


                    if (client.message === "announce") {

                        //thread.console.info(`Got extension client announce`);

                        modelMap[client.clientId] = client;
                        modelMap[client.clientId].lastSeen = new Date();
                        conn._client = client;
                        connMap[client.clientId] = conn;

                        // we don't broadcast but instead let client(s) refresh

                    } else if (client.message === "terminated") {

                        delete modelMap[client.clientId];
                        delete connMap[client.clientId];

                    } else {
                        thread.console.info("Got snapshot")
                        thread.console.debug("snapshot", client);

                        // broadcast the snapshot
                        Object.keys(websockMap).map(function(name:string) {
                            thread.console.debug("Notifying " + name)

                            let websocket = websockMap[name];
                            if (!websocket._dead) {
                                websocket.emit('snapshot', client);
                            }

                        });

                        if (client.requestId) {
                            let callback = requestMap[client.requestId];
                            if (callback) {

                            }
                        }
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

        type LLMRequestT = {
            service: string,
            model: string,
            prompt: string
        }
        app.post("/llm", async function(req, res) {
            let data = req.body as LLMRequestT;
            thread.console.debug("llm", data);

            let p = new Promise(function(resolve, reject) {

                let done = false;
                Object.keys(modelMap).map(function(clientId) {
                    if (done) {
                        return;
                    }

                    let client = modelMap[clientId];
                    if (client.service === data.service &&
                        client.model === data.model) {

                        // we have a match

                        let conn = connMap[client.clientId];
                        if (conn) {
                            thread.console.info("Sending request to connection [" + client.clientId + "]")

                            let requestId = uuid.v4();

                            requestMap[requestId] = function(response) {
                                if (response.error) {
                                    reject(response.error)
                                } else {
                                    resolve(response.data)
                                }
                            }

                            let payload = {
                                clientId: client.clientId,
                                data: data.prompt,
                                requestId
                            };

                            conn.send(JSON.stringify(payload));
                            done = true;
                        } else {
                            thread.console.warn("Skipping bad connection [" + client.clientId + "]")
                        }
                    }

                });

                if(!done) {
                    throw new Error("No eligible client found");
                }
            });

            try {
                let result = await p;
                res.send(result);
            } catch (err) {
                thread.console.softError(err.toString());
                res.send("ERROR: " + err.toString());
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

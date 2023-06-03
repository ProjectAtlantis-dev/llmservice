


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

        let modelMap = {};
        let connMap = {};

        // browser extension connections (no socket.io to keep it simple)
        const wsServer = new WebSocketBase.Server({ port: 3020 });


        // API connections
        server.onConnect = async function(websocket:WebsocketT) {

            websocket.on('request', async function(reqBuffer:string) {

                try {
                    thread.console.bold("Received request from " + websocket._name);

                    let req:RequestT = unsafeHelper.extractUnsafeJSO(thread, reqBuffer, resultBoard);
                    thread.console.debug("request", req);

                    let reply:ReplyT = {
                        handle: req.handle,
                        data: null,
                        error: null
                    };


                    if (req.command === "loadModelMap") {

                        reply.data = modelMap;

                    } else if (req.command === "test") {

                        let clientInfo = req.data as PayloadT;

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


        type PayloadT = {
            hostId: string,
            clientId: string,
            service: string,
            model: string,
            message: string,
            data:string
        }

        wsServer.on('connection', conn => {
            thread.console.info("Extension connected");

            conn._client = null;

            conn.on('message', async function(buffer)  {

                try {

                    let payload:PayloadT = JSON.parse(buffer)
                    thread.console.debug("payload", payload);

                    if (payload.message === "announce") {

                        thread.console.info(`Got extension client announce`)

                        modelMap[payload.clientId] = payload;
                        conn._client = payload;
                        connMap[payload.clientId] = conn;

                        Object.keys(websockMap).map(function(name:string) {
                            thread.console.debug("Notifying " + name)

                            let websocket = websockMap[name];
                            if (!websocket._dead) {
                                websocket.emit('llm_announce', payload.service, payload.model)
                            }

                        })

                    } else if (payload.message === "snapshot") {

                        thread.console.info(`Got extension client snapshot`)

                        Object.keys(websockMap).map(function(name:string) {
                            thread.console.debug("Notifying " + name)

                            let websocket = websockMap[name];
                            if (!websocket._dead) {
                                websocket.emit('llm_snapshot', payload.service, payload.model)
                            }

                        })

                    } else {
                        throw new Error("Unrecognized message type: " + payload.message)
                    }

                } catch (err) {
                    thread.console.softError(err.toString())
                }
            })

            conn.on('close', () => {
                //thread.console.info("Extension client " + conn._client.clientId + " has disconnected");
                thread.console.info("Extension client has disconnected");

                let oldClient:PayloadT = conn._client;

                if (oldClient) {
                    thread.console.debug("client", oldClient);

                    delete modelMap[oldClient.clientId];
                    delete connMap[oldClient.clientId];

                    Object.keys(websockMap).map(function(name:string) {
                        let websocket = websockMap[name];
                        if (!websocket._dead) {
                            websocket.emit('llm_announce', oldClient.service, oldClient.model)
                        }

                    })

                }
            })

        });

        app.get("/", async function(req, res) {
            thread.console.info("Default route")
            res.redirect('/index.html');
        });



        /*
        app.post("/llm_announce", async function(req, res) {
            try {
                thread.console.info("Received LLM announce")
                let data = req.body;
                thread.console.debug("data", data);

                modelMap[data.clientId] = data;

                Object.keys(websockMap).map(function(name:string) {
                    let websocket = websockMap[name];
                    if (!websocket._dead) {
                        websocket.emit('llm_announce', data.service, data.model)
                    }

                })

                //let lines = util.bufferToLines(data.html)
                //lines.length -=2
                //lines.shift()
                //thread.console.debug("lines", lines)
            } catch (err) {
                thread.console.softError(err.toString())
            }
            let result = {x:5}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
        });
        */

        /*
        app.post("/llm_snapshot", async function(req, res) {
            try {
                thread.console.info("Received LLM snapshot")
                let data = req.body;
                thread.console.debug("data", data);

                //let lines = util.bufferToLines(data.html)
                //lines.length -=2
                //lines.shift()
                //thread.console.debug("lines", lines)
            } catch (err) {
                thread.console.softError(err.toString())
            }
            let result = {x:5}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
        });
        */
    }

    let PORTNUM = 3010
    await server.run(PORTNUM, processName);
    server.runWebpack();

    mainThread.console.bold("LLM service ready");

};



try {
    run();

} catch (err) {
    mainThread.console.error(err);
}

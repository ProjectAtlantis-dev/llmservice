
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */



let uuid = require('uuid');


import {ThreadT} from "../types/ThreadT";
let threadManager = require("../selftyped/Thread").manager;

let util = require("../untyped/Util").singleton;

import {SockGenericFunctionT} from "../common/BotCommon";
import {SockMessageFunctionT} from "../common/BotCommon";
import {SockCallbacksT} from "../common/BotCommon";
import {WebsocketT} from "../common/BotCommon";

import {UnsafeBoardT} from "../types/UnsafeBoardT";
let UnsafeBoard = require('../untyped/UnsafeBoard').class;

import {UnsafeHelperT} from "../types/UnsafeHelperT";
let UnsafeHelper = require("../selftyped/UnsafeHelper").class;


import {PrettyT} from "../types/PrettyT";
let pretty:PrettyT = require('../untyped/Pretty').singleton;


import {SockClientT} from "../types/SockClientT";


// not compatible with web page ?
let io = require("socket.io-client");


export class SockClient {
    public thread:ThreadT;
    public wsocket:WebsocketT;

    public onConnect: Function;
    public onConnected: Function;

    constructor() {
        let self = this;

        self.thread = threadManager.get("sock-client");

        process.on('unhandledRejection', function(err) {
            self.thread.console.softError("Unhandled promise rejection");
            self.thread.console.softError(err);
        });

        process.on('uncaughtException', function(err) {
            self.thread.console.softError("Unhandled exception");
            self.thread.console.softError(err);
        });

    }

    private doFatalError(msg:string) {
        let self = this;

        self.thread.console.softError(msg);
        self.thread.console.flush();
        throw new Error(msg)
    };

    private rMap:Object = {};

    public connect(url:string) {
        let self = this;

        self.thread.console.info("Client connecting");

        if (!io) {
            self.doFatalError("Socket library not found");
        }

        if (!url) {

            self.thread.console.info("Using default HTTP websocket");

            self.wsocket = io.connect({
                transports : ['websocket','polling', 'flashsocket'],
                reconnects: true,
                pingTimeout: 60000,
                forceNew: true,
            });

        } else {

            let t = util.valueType(url);
            if (t !== 'string') {
                self.doFatalError("URL must be a string not a " + t);
            }

            // open websocket to server
            // must start with wss://
            self.thread.console.info("Connecting to [" + url + "]");

            self.wsocket = io.connect(url, {
                //agent: https.globalAgent,
                transports : ['websocket','polling', 'flashsocket'],
                pingTimeout: 60000,
                forceNew: true,
                reconnects: true
            });
        }

        self.thread.console.info("Doing setup")

        // these are in-flow messages
        let wtInternalError:SockMessageFunctionT = function(message:string) {
            self.thread.console.softError("(INTERNAL) " + message);
        };
        self.wsocket.on('internal_error', wtInternalError);

        let wtReconnect:SockGenericFunctionT = function() {
            self.thread.console.info("Attempting reconnect");
        };
        self.wsocket.on("reconnect", wtReconnect);

        let wtConnectError:SockMessageFunctionT = function(err) {
            self.thread.console.softError(err.toString());
            self.thread.console.softError("Unable to connect to server (is it running?)");
        };
        self.wsocket.on('connect_error', wtConnectError);

        let wtDisconnect:SockGenericFunctionT = function() {
            self.thread.console.info("Connection reset");
        };
        self.wsocket.on('disconnect', wtDisconnect);

        self.wsocket.on('heartbeat', function () {
            // keepalive

            if (self.wsocket.readyState === self.wsocket.OPEN) {
                //thread.console.debug("Got heartbeat; sending reply");
                self.wsocket.emit('heartbeat_reply');
            } else {
                // not sure if this is possible
                self.thread.console.debug("Got heartbeat but socket is not open ?");
            }

        });


        let firstTimeConnect = true;
        let wtConnect:SockGenericFunctionT = function() {
            if (firstTimeConnect) {
                self.thread.console.info("Connected");
            } else {
                self.thread.console.info("Re-connected");
            }

            if (self.onConnect) {
                self.onConnect(self.wsocket, firstTimeConnect);
            }

            if (firstTimeConnect) {
                firstTimeConnect = false;
            }

        };
        self.wsocket.on('connect', wtConnect);

        let helperThread = threadManager.get("unsafe-helper");
        let unsafeHelper:UnsafeHelperT = new UnsafeHelper(helperThread);
        let resultBoard:UnsafeBoardT = new UnsafeBoard(self.thread, null, {});
        let replyHandler = function(buffer:string) {

            try {
                self.thread.console.bold("Received reply " + buffer);

                let reply = unsafeHelper.extractUnsafeJSO(helperThread, buffer, resultBoard);

                let f = self.rMap[reply.handle];
                if (f) {
                    if (reply.error) {
                        f(undefined, reply.error);
                    } else {
                        f(reply.data, undefined);
                    }

                    delete self.rMap[reply.handle];
                } else {
                    // should not happen
                    self.thread.console.softError("Reply is using an invalid or stale handle " + reply.handle);
                    self.thread.console.debug("dropped reply", reply);
                }
            } catch (err) {
                self.thread.console.softError("Reply failed: " + err.toString());
            }

        };
        self.wsocket.on('reply', replyHandler);

    };

    private makeRequest(clientHandle:string) {
        let self = this;

        let p = new Promise(function(resolve, reject) {
            self.rMap[clientHandle] = async function(data, errorMsg) {
                self.thread.console.info("Got reply");
                // this is a temp function that maps result/error to promise resolve/reject
                if (errorMsg) {
                    // this is a remote error not a connection error
                    self.thread.console.flush();
                    reject(errorMsg);
                } else {
                    resolve(data);
                }
            };
        });

        return p;
    };

    sendRequest(data:any) {
        let self = this;

        try {
            let handle = uuid.v4();
            let p = self.makeRequest(handle);

            //thread.console.debug("sending admin request", msg);
            self.thread.console.debug("Sending request", data)
            let buffer = pretty.inspect(data);
            self.wsocket.emit('request', buffer);

            return p;
        } catch (err) {
            self.thread.console.softError("send request failed: " + err.toString());
            throw err;
        }
    };


};


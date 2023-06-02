


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

import {WebsocketMapT} from "./common/BotCommon";
import {WebsocketT} from "./common/BotCommon";


import {PrintableContentT} from "./common/BotCommon";
import {InspectObjectT} from "./types/InspectObjectT";
let InspectObject = require("./selftyped/InspectObject").class;

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


    server.setup = async function(
        thread:ThreadT,
        unsafeHelper:UnsafeHelperT,
        app: any,
        websockMap:WebsocketMapT) {

        let inspectThread = threadManager.get("inspect");
        let inspectObject:InspectObjectT = new InspectObject(inspectThread);

        server.onConnect = async function(websocket:WebsocketT) {

            let tag = "[nbs] ";
            let sendAttention = function(msg) {
                msg = tag + msg;
                websocket.emit('attention', msg);
            }

            let sendInfo = function(msg) {
                msg = tag + msg;
                websocket.emit('info', msg);
            }

            let sendWarn = function(msg) {
                msg = tag + msg;
                websocket.emit('warn', msg);
            }

            let sendError = function(msg) {
                msg = tag + msg;
                websocket.emit('error', msg);
            }

            sendAttention("You have reached the Node base service");
            //websocket.emit('info', "test info");
            //sendWarn("test warn");
            //sendError("test error");

            /*
            {
                let data = {x:7}
                let buffer = pretty.inspect(data);
                websocket.emit('data', buffer);
            }
            */

            {

                thread.console.info("Connecting to Python base service")
                let client = new SockClient();
                await client.connect("ws://127.0.0.1:3050/");

                sendInfo("Connected to Python base service");

                // processing incoming commands
                websocket.on('message', async function(buffer:string) {
                    thread.console.info("Got message: " + buffer)
                    //client.wsocket.emit('message', buffer);
                });

                client.wsocket.on('info', function(buffer) {
                    //websocket.emit('info', tag + buffer);
                });

                client.wsocket.on('warn', function(buffer) {
                    //websocket.emit('warn', tag + buffer);
                });

                client.wsocket.on('error', function(buffer) {
                    //websocket.emit('error', tag + buffer);
                });

                client.wsocket.on('input', function(buffer) {
                    //websocket.emit('input', tag + buffer);
                });

                client.wsocket.on('attention', function(buffer) {
                    //websocket.emit('attention', tag + buffer);
                });

                client.wsocket.on('data', function(buffer) {
                    //websocket.emit('data', buffer);
                });
            }


        };



    }

    let PORTNUM = 3010
    await server.run(PORTNUM, processName);
    server.runWebpack();

    mainThread.console.bold("Base service (Node) ready");

};



try {
    run();

} catch (err) {
    mainThread.console.error(err);
}

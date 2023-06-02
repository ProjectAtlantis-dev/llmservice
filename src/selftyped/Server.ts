

let threadManager = require("../selftyped/Thread").manager;
import {ThreadT} from "../types/ThreadT";


let express = require('express');
let app = express();
let cors = require('cors');
import { Server as SockServer }  from "socket.io";
let uuid = require('uuid');
let nocache = require('nocache');
let sessions = require('express-session');
let cookieParser = require("cookie-parser");

//let fsLib = require('fs')
//let pathLib = require('path');
//const MarkdownIt = require('markdown-it');
//const md = new MarkdownIt();

require('source-map-support').install();  // stack trace gives us accurate TS line numbers
//require('https').globalAgent.options.ca = require('ssl-root-cas/latest').create();

import {UtilT} from "../types/UtilT";
let util:UtilT = require('../untyped/Util').singleton;

let validate = require('./Validate').singleton;

import {UnsafeBoardT} from "../types/UnsafeBoardT";
let UnsafeBoard = require('../untyped/UnsafeBoard').class;

import {UnsafeHelperT} from "../types/UnsafeHelperT";
let UnsafeHelper = require("../selftyped/UnsafeHelper").class;

import {WebPackHelperT} from "../types/WebPackHelperT";
let WebPackHelper = require("../selftyped/WebPackHelper").class;

import {WebsocketMapT} from "../common/Common";
import {WebsocketT} from "../common/Common";



import { ServerT } from "../types/ServerT";



let Server = function(thread:ThreadT):ServerT {
    let self:ServerT = this;

    self.setup = null;
    self.onDisconnect = null;
    self.onConnect = null;

    self.baseAppConfig = null;  // optional

    self.runWebpack = function() {

        /********************/
        /* WEB WORKER STUFF */
        /********************/

        let workingDir = process.cwd();
        let baseDir = "/web";
        let webPackThread = threadManager.get("webpack");
        let webPackHelper:WebPackHelperT = new WebPackHelper(webPackThread);

        webPackThread.console.info("Working dir: " + workingDir);
        webPackThread.console.info("Base dir: " + baseDir);

        // WEBPACK VOODOO:
        // make sure you have <script src="/bundle.js"></script> in the web page
        // and any server-side stuff put in entry.js will be avail on the browser
        // although any node-specific server stuff may not actually work, at least
        // you don't get build errors
        webPackHelper.start({
            entryPath: workingDir + baseDir + "/entry.js",
            outputPath: workingDir + baseDir,
            outputFile: "bundle.js"
        });

    };

    self.run = async function(defaultPort:number, processName:string) {
        if (process.env.NODE_ENV === "production") {
            thread.console.warn("You are running in PRODUCTION mode");
        } else {
            thread.console.softError("You are running in TEST mode");
        }


        app.use(cors());
        app.use(nocache());

        // auth stuff
        const oneDay = 1000 * 60 * 60 * 24;
        app.use(sessions({
            secret: uuid.v4(),
            saveUninitialized:true,
            cookie: { maxAge: oneDay },
            resave: false
        }));
        app.use(cookieParser());

        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());  // same as body parser json

        // now to secure pages w logging
        if (self.baseAppConfig) {
            self.baseAppConfig(thread, app);

        } else {
            app.use(async function (req, res, next) {

                const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                thread.console.debug("Client request from " + ip + " " + req.path);
                thread.console.flush();

                if (req.path.indexOf("..")>=0) {
                    // main screen
                    res.redirect('/');
                    return;
                }

                if (req.path === "/favicon.ico") {
                    thread.console.info("Fetching unsecure " + req.url);
                    next();
                    return;
                }

                if ((req.path.indexOf("/bundle.js")===0)) {
                    thread.console.info("Fetching unsecure " + req.url);
                    next();
                    return;
                }

                if ((req.path.startsWith("/style/")===0)) {
                    thread.console.info("Fetching unsecure " + req.url);
                    next();
                    return;
                }

                if ((req.path.indexOf("/fonts")===0)) {
                    thread.console.info("Fetching unsecure " + req.url);
                    next();
                    return;
                }

                if ((req.path.indexOf("/images")===0)) {
                    thread.console.info("Fetching unsecure " + req.url);

                    const cacheDuration = 60 * 60 * 24 * 30; // 30 days
                    res.setHeader('Cache-Control', `public, max-age=${cacheDuration}`);

                    next();
                    return;
                }

                if ((req.path.indexOf("/private")>=0)) {

                    if (req.session.auth) {

                        // check auth again ?

                        thread.console.warn("Fetching secure " + req.url);

                        next();
                        return;
                    } else {

                        thread.console.softError("Auth missing on attempt to fetch private " + req.url);
                        // path needs auth
                        req.session.redirect = req.url;
                        res.redirect('/');
                        return;
                    }
                } else {

                    thread.console.info("Fetching generic unsecure " + req.url);
                    next();
                }
            });
        }


        // put this after because we are paranoid
        app.use(express.static('web'));

        let port = process.env.PORT || defaultPort;
        thread.console.info(`Listening on port ${port}`);
        let appServer = app.listen(port);

        let websockMap:WebsocketMapT = {};
        let sockCnt = 0;


        let unsafeHelper:UnsafeHelperT = new UnsafeHelper(threadManager.get("unsafe"));

        self.pingTelemetry = function(websocket:WebsocketT) {
            // not currently used
        }


        // web output terminal and IDE refresh
        let wsServer = new SockServer(appServer, {
            maxHttpBufferSize: 1e8,
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // @ts-ignore
        wsServer.on('connection', async function(websocket:WebsocketItemT) {

            try {

                websocket._created = new Date();

                // temp name
                websocket._name = processName + "_client" + sockCnt++;
                // timeout not needed if using keepalive
                //websocket.setTimeout(30 * 1000);

                thread.console.info("Websocket [" + websocket._name + "] connected");

                let testSockObj = websockMap[websocket._name];
                if (!testSockObj) {
                    websockMap[websocket._name] = websocket;
                }

                websocket.on('disconnect', async function () {
                    thread.console.softError("Disconnecting websocket [" + websocket._name + "]");

                    websocket._dead = true;

                    if (self.onDisconnect) {
                        try {
                            await self.onDisconnect(websocket._name);
                        } catch (err) {
                            thread.console.softError("onDisconnect failed: " + err.toString());
                        }
                    }

                    delete websockMap[websocket._name];

                    // notify other sockets for this login that there was a telemetry change
                    self.pingTelemetry(websocket);

                });

                if (self.onConnect) {
                    try {
                        await self.onConnect(websocket);
                    } catch (err) {
                        thread.console.softError("onConnect failed: " + err.toString());
                    }
                }


                websocket.emit('connected');

                self.pingTelemetry(websocket);

            } catch (err) {
                thread.console.softError(err);
            }
        });


        appServer.on('upgrade', function(request, socket, head) {
            thread.console.bold("Upgraded to websocket");
        });

        if (self.setup) {
           await self.setup(
               thread,
               unsafeHelper,
               app,
               websockMap);

        } else {
            thread.console.softError("Server setup callback missing");
        }

        thread.console.bold("Server ready");
    }

    return self;
};

module.exports = { class: Server };






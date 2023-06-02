/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */

let utl = require('util');

import {UtilT} from "../types/UtilT";
let util:UtilT = require("../untyped/Util").singleton;

import {ConsoleStreamT} from "../types/ConsoleStreamT";
import {ThreadConsoleT} from "../types/ThreadConsoleT";


// NO THREADS HERE!!!
let ThreadConsole = function(id:string, name:string, defaultColor:string, stream:ConsoleStreamT):ThreadConsoleT {
    // @ts-ignore
    let self:ThreadConsoleT = this;

    self.id = id;
    self.name = name;
    self.depth = 15;
    self.stream = stream;
    self.timings = [];

    self.defaultColor = defaultColor;
    self.callingThreadName = [];
    self.callingThreadColor = [];

    // to flush the console, you need to flush the underlying stream
    self.flush = function() {
        self.stream.tick();
    };

    self._createMsg = function(type:string, msg:string, debugObj:Object) {
        let obj = {
            consoleId: self.id,
            type: type,
            msg: msg,
            obj: "",
            threadName: self.name,
            threadColor: self.defaultColor,
            when: new Date(),
            callingThreadName: "",
            callingThreadColor: ""
        };

        if (typeof debugObj !== 'undefined') {
            let t = util.valueType(debugObj);

            if (t !== 'null') {

                // need to port to utl.inspect.custom
                obj.obj = utl.inspect(debugObj,{
                    colors: true,
                    depth: self.depth,
                    maxArrayLength: 50
                }) + "\n";

                //console.log(obj.obj);

            }
        }

        // for RPC
        if (self.callingThreadName.length > 0) {
            obj.callingThreadName = self.callingThreadName[self.callingThreadName.length-1];
            obj.callingThreadColor = self.callingThreadColor[self.callingThreadColor.length-1];
        }

        return obj;
    };

    self.createMsg = function(type:string, msg?:string, debugObj?:any) {
        let obj = self._createMsg(type, msg || "", debugObj);
        stream.push(obj);
        stream.idle();
    };

    // console.table([cols], values)
    self.table = function(rows:[]) {
        self.createMsg('table',"Table:", rows);
    };

    // max call size exceeded means that object too large for inspect
    // WARNING: does NOT make copy of object so it may change
    self.inspect = function(msg:string, obj:Object) {
        self.createMsg('inspect', msg, obj);
    };

    self.info = function(msg, obj) {
        self.timings.push({name:"info: " + msg.substring(0,50), date:new Date()});
        self.createMsg('info', msg, obj);
    };
    self.fancy = self.info;

    self.debug = function(msg, obj) {
        self.createMsg('debug', msg, obj);
    };

    self.warn = function(msg, obj) {
        self.createMsg('warn', msg, obj);
    };
    self.warning = self.warn;

    self.list = function(obj) {
        self.createMsg('info', "list", obj);
    };

    // compatibility w default; note that websocket console is probably what is being called at client level
    self.log = self.info;

    self.bulk = function(msg, color, obj) {
        self.createMsg('info', msg + ": " + color, obj);
    };

    self.pre = function(msg, obj) {
        self.createMsg('pre', msg, obj);
    };

    self.underline = function(msg, obj) {
        self.createMsg('info', msg, obj);
    };

    self.edit = function(msg, buf, mode, callback) {
        callback(buf);
    };

    // emphasis
    self.bold = function(msg, obj) {
        self.createMsg('bold', msg, obj);
    };

    self.isVerbose = false;
    //self.isVerbose = true;
    self.verbose = function(msg, obj) {
        if (self.isVerbose) {
            // only store if verbose is enabled
            self.debug(msg, obj);
        }

    };

    // does throw
    self.error = function(msg) {
        self.createMsg('error', new Error().stack);
        throw msg;
    };

    self.softError = function(msg, obj) {

        if (!msg) {
            return;
        }

        let tm = util.valueType(msg);
        if (tm !== "string") {
            if (tm === 'error') {
                self.createMsg('softError',  msg.message);//"Unknown error (did you try to pass error itself instead of text?)");
                return;
            } else if (tm === 'object') {
                self.createMsg('softError',  "Unknown error (did you try to pass thread instead of text?)");
                return;
            } else {
                self.createMsg('softError',  "Unknown error (was passed " + tm + " instead of text)");
                return;
            }

        }

        if (msg.err) {
            msg = msg.err;
        }
        if (msg.stack) {
            msg = msg.message;
        }

        while (msg.toUpperCase().startsWith("ERROR: ")) {
            msg = msg.substring(7);
        }
        self.createMsg('softError',  msg, obj);


    };

    return self;
};

module.exports = { class: ThreadConsole };

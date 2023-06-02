/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */

let moment = require('moment');

let ColorFormat = require('./ColorFormat').class;

import {UtilT} from "../types/UtilT";
let util:UtilT = require('../untyped/Util').singleton;


import {ConsoleStreamT} from "../types/ConsoleStreamT";

import {ConsoleMessageT} from "../common/BotCommon";



// no threads

let ConsoleStream = function():ConsoleStreamT {
    // @ts-ignore
    let self:ConsoleStreamT = this;

    self.colorFormat = new ColorFormat();

    self.consoleColors = [
        'white',
        'grey',
        'cyan.dim.bold',
        'blue.dim.bold',
        'green.dim.bold',
        'magenta.dim.bold',
        'yellow.dim.bold',
        'cyan',
        'blue',
        'green',
        'magenta'
    ];

    self.defaultColorTypeMap = {
        'debug':        'grey.dim',
        'info':         'white',
        'bold':         'white.bold',
        'softError':    'red',
        'warn':         'yellow',
        'error':        'red'
    };

    self.prefixMap = {
        'debug':        'DEBUG: ',
        'info':         '',
        'bold':         '',
        'softError':    'ERROR: ',
        'warn':         'WARNING: ',
        'error':        'ERROR: '
    };

    // need a way to convert these terminal colors back to web (terminal
    // colors pre-date the web by a long time)
    self.convertColorToWeb = function(colorName:string) {

        if (!colorName) {
            console.log("Invalid color supplied to convertColorToWeb");
            return "#ffffff";
        }

        if (colorName.endsWith(".bold")) {
            colorName = colorName.substring(0, colorName.length-5);
        }
        //console.log("Looking for color [" + colorName + "]");

        switch(colorName) {
            case 'white':
                    return "#ffffff";
            case 'white.dim':
                    return "#c0c0c0";
            case 'grey':
                    return "#808080";
            case 'grey.dim':
                    return "#4e4e4e";
            case 'cyan':
                    return "#00ffff";
            case 'cyan.dim':
                    return "#008080";
            case 'blue':
                    return "#0000ff";
            case 'blue.dim':
                    return "#000080";
            case 'green':
                    return "#00ff00";
            case 'green.dim':
                    return "#008000";
            case 'magenta':
                    return "#ff00ff";
            case 'magenta.dim':
                    return "#800080";
            case 'yellow':
                    return "#ffff00";
            case 'yellow.dim':
                    return "#808000";
            default:
                    // white
                    return "#ffffff";
        }

    };


    self.lastLen = 0;
    self.queue = [];

    self.watchers = [];
    self.addWatcher = function(callback:Function) {
        //console.log("Added watcher");
        let idx = self.watchers.length;
        self.watchers.push(callback);
        return idx;
    };

    self.removeWatcher = function(idx:number) {
        self.watchers.splice(idx,1);
    };

    self.push = function(msgObj:ConsoleMessageT) {
        msgObj.id = self.queue.length;
        self.queue.push(msgObj);
    };

    self.formatText = function(msg:ConsoleMessageT) {

        let defTypeFuncName = self.defaultColorTypeMap[msg.type];
        let defTypeFunc:Function;
        if (defTypeFuncName) {
            defTypeFunc = self.colorFormat.getColorFunc(defTypeFuncName);
        } else {
            defTypeFunc = self.colorFormat.getColorFunc('white');
        }

        if (!msg.threadColor) {
            // usually suggests a thread got scrambled
            console.log("Missing thread color");
            console.log(msg);
        }
        let defThreadFunc = self.colorFormat.getColorFunc(msg.threadColor);

        let prefix = self.prefixMap[msg.type];
        if (!prefix) {
            prefix = "";
        }

        let suffix = "";
        if (msg.type === 'info') {
            suffix = defThreadFunc(prefix + msg.msg);
        } else if (msg.type !== 'pre') {
            suffix = defTypeFunc(prefix + msg.msg);
        } else {
            suffix = prefix + msg.msg;
        }

        // this is the main output log line
        let buf = "[" + moment(msg.when).local().format("H:mm:ss") + " " + msg.id + "]" + ".".repeat(msg.consoleId % 30);

        buf += defThreadFunc("[" + msg.threadName);

        if (msg.callingThreadName && msg.callingThreadColor) {
            buf += self.colorFormat.getColorFunc(msg.callingThreadColor)(" " + msg.callingThreadName);
        }

        buf += defThreadFunc("]");

        buf += " " + suffix;

        buf += "\n";

        if (typeof msg.obj !== 'undefined') {
            buf += msg.obj;
        }


        return buf;
    };

    self.tick = function() {
        //console.log("Stream console is idle");

        // compute delta
        let newLen = self.queue.length;
        let diffs = self.queue.slice(self.lastLen, newLen);

        if (diffs.length > 0) {
            //console.log("Calling watchers");
            if (self.watchers.length > 0) {
                self.watchers.map(function(watcher:Function) {
                    try {
                        //console.log("Calling watcher");
                        watcher(diffs);
                    } catch (err) {
                        console.error(err);
                    }
                });

            } else {
                try {
                    // default text fallback
                    //console.log("Console stream found " + diffs.length + " diff(s)");

                    let buf = "";
                    diffs.map(function(obj:ConsoleMessageT) {
                        buf += self.formatText(obj);
                    });
                    console.log(buf);

                } catch (err) {
                    console.log(err);
                }

            }
        }

        self.lastLen = newLen;

    };

    self.idleDelay = 150;
    self.idle = util.debounce(function() {
        self.tick();
    }, self.idleDelay);

    return self;
};

module.exports = { class: ConsoleStream };

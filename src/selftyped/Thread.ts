/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */

let ConsoleStream = require("./ConsoleStream").class;
let ThreadConsole = require("./ThreadConsole").class;

import {ThreadT} from "../types/ThreadT";

type ThreadManagerT = {
    get: Function,
    threads: any
};

const globalAny:any = global;

// NOTE THIS HAS GLOBAL IMPORTS

import {ThreadConsoleT} from "../types/ThreadConsoleT";


// notion of threading is mainly for driving the logging/debugging using colors
// this basic thread model does not track parent child trees or maintain a call stack
let Thread = function (name:string, internalConsole?:ThreadConsoleT):ThreadT {
    // @ts-ignore
    let self:ThreadT= this;

    // the 'name' of the thread actually lives in the console; this is only for debugging
    // and may not be accurate
    self._name = name;

    self.console = undefined;

    self.isThread = true;

    if (internalConsole) {
        self.console = internalConsole;
    } else {

        //return new Console(id, name, defaultColor, stream);
        let id = Object.keys(globalAny.threadManager.threads).length + 1;

        let defaultColor = globalAny.globalStream.consoleColors[globalAny.consoleColorIdx++];
        //console.log("Assigned color " + defaultColor);
        if (globalAny.consoleColorIdx === globalAny.globalStream.consoleColors.length) {
            globalAny.consoleColorIdx = 0;
        }

        self.console = new ThreadConsole(id + "", name, defaultColor, globalAny.globalStream);
    }

    return self;
};


let ThreadManager = function():ThreadManagerT {
    // @ts-ignore
    this.threads = {};

    // @ts-ignore
    this.get = function(key:string) {
        let thread = this.threads[key];
        if (!thread) {
            //console.log("CREATING THREAD: " + key);
            // must use new keyword here or else hangs w heap error
            // i don't care what TS thinks
            // @ts-ignore
            thread = this.threads[key] = new Thread(key, null);
            //console.log("Thread created");
        }
        return thread;
    };

    // @ts-ignore
    return this;
};

// stubs for browser?
if (typeof globalAny.threadManager === 'undefined') {
    // the below line MUST have a new or shit blows up
    // @ts-ignore
    globalAny.threadManager = new ThreadManager();
    globalAny.globalStream = new ConsoleStream();
    globalAny.consoleColorIdx = 0;
}

//console.log("Creating internal thread");
let internal = globalAny.threadManager.get("internal");

module.exports = { class: Thread, internal: internal, manager: globalAny.threadManager, stream: globalAny.globalStream};

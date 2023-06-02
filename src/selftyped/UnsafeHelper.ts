/* eslint-disable @typescript-eslint/naming-convention */

// this is groovy

let PromiseB = require('bluebird');


import {UtilT} from "../types/UtilT";
let util:UtilT = require('../untyped/Util').singleton;


import {UnsafeBoardT} from "../types/UnsafeBoardT";
let UnsafeBoard = require('../untyped/UnsafeBoard').class;

let validate = require("../selftyped/Validate").singleton;

let threadManager = require("../selftyped/Thread").manager;
import {ThreadT} from "../types/ThreadT";

import {PrettyT} from "../types/PrettyT";
let pretty:PrettyT = require('../untyped/Pretty').singleton;

import { UnsafeHelperT } from "../types/UnsafeHelperT";



let UnsafeHelper = function (thread:ThreadT):UnsafeHelperT {
    // @ts-ignore
    let self:UnsafeHelperT = this;

    // if not bulkload then will add exports prefix
    self.extractUnsafeJSO = function(thread:ThreadT, buf:string, board?:UnsafeBoardT, bulkLoad:boolean = false) {
        // parse as JSO

        if (!board) {
            thread.console.info("Extract JSO is using new board");
        }

        if (!buf) {
            thread.console.warn("No text provided to unsafe JSO");
            return {};
        }

        try {

            let b = board || new UnsafeBoard(thread);

            if (!bulkLoad) {
                //thread.console.warn("Extract JSO adding 'exports'");
                buf = "exports = " + buf;
                //thread.console.info(buf);
            }

            // 'run' instead of load to preserve col order where applicable
            b.run(thread, buf);

            // note that code target itself is already 'exports'
            let obj = b.getCodeTarget().exports;

            if (!bulkLoad && !Reflect.has(b.getCodeTarget(), "exports")) {
                thread.console.debug("No 'exports' found after loading board");
            }
            //thread.console.debug("JSO obj", obj);
            return obj;

        } catch (err) {
            thread.console.softError("Unable to parse unsafe JSO:\n" + util.trimText(buf,500));
            // @ts-ignore
            throw new Error(err);
        }
    };


    self.evalUnsafeFunction = async function(
        thread:ThreadT,
        jsoBoard:UnsafeBoardT,
        funcPath:string,
        func:Function,
        argsObj:any):Promise<any> {

        thread.console.debug("Running function [" + funcPath + "]");

        //await computation.info("--- Prepare function [" + mo.monad.name + " " + methodPath + "] ---","#dd7d00");

        // chase params
        let ta = util.valueType(argsObj);
        thread.console.debug("args obj", argsObj);
        let params = util.getArgs(func);
        //thread.console.debug("params", params);

        if (ta === 'object') {

            thread.console.debug("Resolving param OBJECT");

            await PromiseB.each(params, async function(p) {
                if (Reflect.has(argsObj, p)) {

                    let tap = util.valueType(argsObj[p]);

                    thread.console.info("Found parameter [" + p + "] in args object as " + tap + ": " + argsObj[p]);

                } else {
                    jsoBoard.getCodeTarget()["sys"].logger.warn("Unable to resolve parameter '" + p + "\'");
                }

            });
        } else if (ta != 'array' && params.length <= 1) {
            // ignore
        } else if (ta != 'array') {
            jsoBoard.getCodeTarget()["sys"].logger.error("Invalid parameter type: " + ta);
        }



        let retval;
        try {

            // may throw exception
            if (ta === "object" ||
                ta === "undefined" ||
                ta === "null") {

                argsObj = argsObj || {};

                //thread.console.debug("args", argsObj);

                retval = await util.applyObjectElements(
                    func,
                    argsObj,
                    null,
                    jsoBoard.getCodeArea());

            } else {

                // assume array has args ?

                let newArgsObj = {};
                let p = 0;
                let argsConsumed = false;
                while (p < params.length) {
                    if (!Reflect.has(argsObj, params[p])) {
                        if (!argsConsumed) {
                            newArgsObj[params[p]] = argsObj;
                            argsConsumed = true;
                        } else {
                            // leave null
                        }
                    } else {
                        newArgsObj[params[p]] = argsObj[p];
                    }
                    p++;
                }

                thread.console.debug("new args", newArgsObj);

                retval = await util.applyObjectElements(
                    func,
                    newArgsObj,
                    null,
                    jsoBoard.getCodeArea());

            }

            //await computation.info("--- End function [" + mo.monad.name + " " + methodPath + "] ---", "#00ff7f");  // spring green

        } catch (err:any) {
            //await computation.softError("Function [" + mo.monad.name + " " + methodPath + "] failed");
            let msg = err.toString();
            if (msg.startsWith("Error: ")) {
                msg = msg.substring(7);
            }
            thread.console.softError("EVAL UNSAFE FUNCTION FAILED: " + msg);
            throw err;
        }


        return retval;
    };


    // we hope this is a function path but need to verify first
    self.evalUnsafePath = async function(
        thread:ThreadT,
        jsoBoard:UnsafeBoardT,
        funcPath:string,
        argsObj:any):Promise<any> {

        //thread.console.debug("Eval unsafe path [" + funcPath + "]");

        // will fail if path is invalid
        let funcObj = jsoBoard.resolvePath(funcPath);
        let pt = util.valueType(funcObj);


        // use default resolver e.g. just look for function by name
        // and pass args (if any) as is

        if (pt === 'function') {

            let retval = await self.evalUnsafeFunction(
                thread,
                jsoBoard,
                funcPath,
                funcObj,
                argsObj);

            return retval;

        } else {
            // pass thru
            return funcObj;
        }

    };



    return self;
};

module.exports = { class: UnsafeHelper };



/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */


let Convert = require('ansi-to-html');

let utl = require('util');
let moment = require('moment');

import {UtilT} from "../types/UtilT";
let util:UtilT = require('../untyped/Util').singleton;

let validate = require("../selftyped/Validate").singleton;

let threadManager = require("../selftyped/Thread").manager;
import {ThreadT} from "../types/ThreadT";

import {DocumentShimT} from "../types/DocumentShimT";
let DocumentShim = require("../selftyped/DocumentShim").class;

import {TabDataFieldMapT} from "../common/BotCommon";

import {TableHelperT} from "../types/TableHelperT";
let TableHelper = require("../selftyped/TableHelper").class;

import { InspectObjectT } from "../types/InspectObjectT";

import {PrintableContentT} from "../common/BotCommon";




let InspectObject = function (thread:ThreadT):InspectObjectT {
    // @ts-ignore
    let self:InspectObjectT = this;


    // returns table data or html
    // WARNING: terminal verbose mode may break if you fiddle with output for 'undefined' since it
    // tries to match verbatim html
    self.objectToHTML = function(obj:any, colDefs:TabDataFieldMapT):PrintableContentT {

        let t = util.valueType(obj);

        thread.console.warn("OBJECT TO HTML: " + t);

        if (t === "array") {
            let doTable = false;

            let arr = obj as Array<any>;
            if (arr.length) {

                let firstElement = arr[0];
                let ft = util.valueType(firstElement);
                if (ft === "object") {
                    // assume table ?
                    doTable = true;
                } else {
                    // treat as data
                }

            } else {
                // empty
                doTable = true;
            }

            if (doTable) {
                let document:DocumentShimT = new DocumentShim(thread);

                let content = document.createElement("div");
                content.style.display = "block";
                thread.console.info("Created content");

                let tableThread = threadManager.get("table helper");
                let tableHelper:TableHelperT = new TableHelper(tableThread, document, content);

                tableHelper.render(colDefs || {},obj);

                let html = content.outerHTML();
                //thread.console.debug("table html:\n" + html);

                return { htmlOutput: html};
            }

        } else if (t === "string") {

            if (obj.startsWith("<!DOCTYPE html")) {
                return { htmlOutput: obj };
            } else if (obj.startsWith("http")) {
                if (obj.endsWith(".png") ||
                    obj.endsWith(".jpg") ||
                    obj.endsWith(".jpeg") ||
                    obj.endsWith(".gif")) {

                    // try to render image

                    let document:DocumentShimT = new DocumentShim(thread);

                    let div = document.createElement("div");
                    div.style.display = "block";
                    div.style.height = "200px";

                    let image = document.createElement("img");
                    image.src = obj;
                    image.height = "100%";
                    image.alt = obj;

                    div.appendChild(image);

                    let html = div.outerHTML();

                    return { htmlOutput: html };
                } else {
                    // fall thru below
                }
            }

            // see if newlines
            if (obj.indexOf("\n") >= 0) {
                // send string untouched so it goes to monaco
                return { stringOutput: obj };
            } else {
                // no newline(s); fall thru to string inspect below
                if (!obj.length) {
                    obj = "<empty string>";
                }
            }

            /*
            let lines:Array<string> = util.bufferToLines(obj);
            if (lines.length > 1) {
                let document:DocumentShimT = new DocumentShim(thread);

                let content = document.createElement("div");
                content.style.display = "block";
                content.style.whiteSpace = "pre";
                thread.console.info("Creating text content");

                lines.map(function(lineStr, idx) {
                    let lineContent = document.createElement("div");
                    let lineNumSpan = document.createElement("span");
                    let lineText = String(idx+1).padStart(3, '0');
                    lineNumSpan.innerHTML = lineText
                    lineNumSpan.style.paddingLeft = "1ch";
                    lineNumSpan.style.paddingRight = "1ch";
                    lineNumSpan.style.color = "#4e4e4e";
                    //lineNumSpan.style.backgroundColor = "#000";
                    lineContent.appendChild(lineNumSpan);

                    let lineTextSpan = document.createElement("span");
                    lineTextSpan.innerHTML = lineStr;
                    lineContent.appendChild(lineTextSpan);

                    //thread.console.info("Created content line " + idx);
                    content.appendChild(lineContent);
                });

                //content.innerHTML = obj;  // remember this is just a shim so there is no innerHTML

                let html = content.outerHTML();
                //thread.console.debug("table html:\n" + html);

                return html;
            } else {
                thread.console.warn("No newlines found; sending string as inspect");
            }
            */
        }


        // some sort of object past here

        let stampFunction = function(f:Function) {
            const customInspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            f[customInspectSymbol] = function(depth, options, inspect) {
                if (depth < 0) {
                    return options.stylize("[function]", "special");
                }

                // we need to keep w Function format since we can't stamp all of them
                let buffer = "[Function: " + this.name + "(" + util.getArgs(this).join(",") + ")]";
                const str = options.stylize(buffer, "special");

                return str;
            }
        }

        if (t === "function") {
            stampFunction(obj);
        } else if (t === "object") {

            try {
                // this is node spefic; will not work in browsser
                if (utl.types.isProxy(obj)) {
                    if (Reflect.has(obj, "data")) {
                        obj = obj._internal;
                    }
                }
            } catch (err) {
                if (Reflect.has(obj, "data") && Reflect.has(obj,"_internal")) {
                    obj = obj._internal;
                }

            }

            Object.keys(obj).map(function(k) {
                try {
                    let subObj = obj[k];
                    if (util.valueType(subObj) === "function") {
                        stampFunction(subObj);
                    }
                } catch (err) {
                    // probably not inspectable
                }
            });
        }

        let ansiBuffer = utl.inspect(obj,{
            colors: false,  // force stylize below
            depth: 14,
            maxArrayLength: 100,
            maxStringLength: 1000,
            breakLength: 200,
            showProxy: true,
            compact: false,
            sorted: false,
            stylize: function(str, styleType) {
                //thread.console.info("str: " + str);
                //thread.console.info("color style type: " + styleType);

                if (styleType === "date") {
                    // if you mess w date here be sure to check tableHelper too
                    // use expanded date here
                    str = moment(str).format('ddd MMM DD HH:mm:ss YYYY Z');
                    //str = util.formatDate(str);
                }

                const style = utl.inspect.styles[styleType];
                if (style !== undefined) {
                  const color = utl.inspect.colors[style];
                  return `\u001b[${color[0]}m${str}\u001b[${color[1]}m`;
                }
                return str;
            }
        }) + "\n";
        //thread.console.info("inspection buffer:\n" + ansiBuffer);

        ansiBuffer = util.replace("\\[Object: null prototype\\] ","", ansiBuffer);
        //thread.console.info("inspection buffer:\n" + ansiBuffer);

        let convertOpts = {
            fg: "#9090c0",  // default ibm blue
            //fg: "#f5bc4b",  // amber
            escapeXML: true
        }
        let convert = new Convert(convertOpts);

        // i think this has the unfortunate side effect of nesting spans
        let html = `<span style='color:${convertOpts.fg}'>` + convert.toHtml(ansiBuffer) + "</span>";
        // A0A is purple
        html = util.replace("color:#A0A","color:#00c4aa", html); // date; default purple to cyan
        html = util.replace("color:#555","color:#A0A", html); // undefined; default grey to purple
        html = util.replace("color:#0AA","color:#a0a0a0", html); // function text; grey
        html = util.replace("color:#A50","color:#b4821f", html); // number; amber
        html = util.replace("color:#0A0","color:#00fa9ade", html); // string; green3
        html = util.replace(`<span style="color:#FFEB33">false`,`<span style="color:#dd7d00">false`, html); // boolean; amber
        html = util.replace(`<span style="color:#FFEB33">true`,`<span style="color:#dd7d00">true`, html);  // boolean; amber
        html = util.replace(`null`,`<span style="color:#4e4e4e">null</span>`, html); // null; dark grey

        //thread.console.info("inspection html:\n" + html);

        return { htmlOutput: html};
    };











    return self;
};

module.exports = { class: InspectObject };







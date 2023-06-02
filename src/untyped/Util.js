/* eslint-disable curly */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-empty */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-var-requires */

let pathLib = require('path');
let utl = require("util");
let underscore = require('underscore');
let moment = require("moment");
let json2csvLib = require('json2csv');
let stripComments = require('strip-json-comments');



// only use default console here


let Util = function() {
    let self = this;


    self.hashCode = function(str) {
      let hash = 0, i, chr;
      if (str.length === 0) {
        return hash;
      }

      for (i = 0; i < str.length; i++) {
        chr   = str.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
      }
      return hash;
    };

    // convert to Excel col naming scheme; 1=A, 26=Z, 27=AA, 28=AB etc.
    self.convertToNumberingScheme = function(number) {
        let baseChar = ("A").charCodeAt(0),
        letters  = "";

        do {
            number -= 1;
            letters = String.fromCharCode(baseChar + (number % 26)) + letters;
            number = (number / 26) >> 0; // quick `floor`
        } while(number > 0);

        return letters;
    };

    self.columnToLetter = function(column) {
        let temp;
        let letter = '';
        let col = column;
        while (col > 0) {
          temp = (col - 1) % 26;
          letter = String.fromCharCode(temp + 65) + letter;
          col = (col - temp - 1) / 26;
        }
        return letter;
    };

    self.letterToColumn = function(letter) {
        let column = 0;
        const { length } = letter;
        for (let i = 0; i < length; i++) {
          column += (letter.charCodeAt(i) - 64) * 26 ** (length - i - 1);
        }
        return column;
    };


    self.getPivotInfo = function(sourceDir, pivotSeg, separator) {

        // we want to pivot on a segment called 'src' if possible
        let sourceSegs = sourceDir.split(separator);

        // try to find topmost folder called 'src'
        let upstream = [];
        let downstream = [];
        let found = false;
        sourceSegs.map(function(seg) {
            if (!found) {
                found = (seg === pivotSeg);
            }

            if (!found) {
                upstream.push(seg);
            } else {
                downstream.push(seg);
            }
        });

        return {
            upstream,
            downstream,
            found
        };

    };

    self.repeat = function(n, f) {
        while (n > 0) {
            f(n--);
        }
    };

    self.initCapsWord = function(s) {
        if (s.length > 0) {
            s = s.charAt(0).toUpperCase() + s.substring(1);
            return s;
        } else {
            return '';
        }
    };

    self.initCaps = function(s) {
        let tokens = self.split(s, " ");
        let newTokens = [];
        tokens.map(function(w) {
            newTokens.push(self.initCapsWord(w));
        });
        return newTokens.join(" ");
    };

    self.jsonToCSV = function(obj) {
        try {
            if (obj.data && self.valueType(obj.data) === 'array' && obj.data.length > 0) {
                let fr = obj.data[0];
                if (self.valueType(fr) !== 'object') {
                    // convert to object array
                    let newArr = [];
                    obj.data.map(function(or) {
                        newArr.push({data:or});
                    });
                    obj.data = newArr;
                }
                return json2csvLib(obj);
            } else {
                return "";
            }
        } catch (err) {
            return err;
        }
    };

    self.getErrorLine = function(err) {
        let errorLine = -1;
        if (err.stack) {
            //let tokens = err.stack.split(":");
            let tokens = err.stack.split("anonymous>:");
            if (tokens.length >= 2) {
                //let target = tokens[1];
                //errorLine = target.split(":")[1];
                errorLine = tokens[1].split(":")[0];
            }
            //console.log(err.stack);
        }
        return errorLine;
    };

    self.stripJSONComments = function(s) {
        return stripComments(s);
    };

    // used by validate
    self.getCaller = function() {
        let err;
        let s = new Error().stack;
        //console.debug(s);
        let tokens = s.split("at ");
        if (tokens.length >= 4) {
            let target = tokens[3];
            if (tokens[3]) {
                if (typeof target === "string") {
                    let func = target.split("(")[0];
                    let caller = func.split(".")[0];
                    return caller;
                } else {
                    err = "Wrong target type";
                }
            } else {
                err = "No target found";
            }
        } else {
            err = "Insufficient stack depth: " + tokens.length;
        }
        console.error("Unable to parse call stack (" + err + ")");
    };

    /*
    let myEfficientFn = debounce(function() {
       // All the taxing stuff you do
    }, 250);
    */
    // RETURNS 'DEBOUNCED' FUNCTION DOES NOT MAKE ACTUAL CALL YET
    // MUST INVOKE SAME DEBOUNCED FUNCTION FOR THINGS TO WORK, NOT
    // CREATE A NEW ONE EACH TIME !!
    self.debounce = function(fn, delay) {
        return underscore.debounce(fn, delay);
        /*
    	let timeout;
    	return function() {
    		let context = this, args = arguments;
    		let later = function() {
    			timeout = null;
    			if (!immediate) func.apply(context, args);
    		};
    		let callNow = immediate && !timeout;
    		clearTimeout(timeout);
    		timeout = setTimeout(later, wait);
    		if (callNow) func.apply(context, args);
    	};
        */
    };

    self.throttle = function(fn, delay) {
        return underscore.throttle(fn, delay);
        /*
        let lastCall = 0;
        return function (...args) {
            const now = (new Date).getTime();
            if (now - lastCall < delay) {
                return;
            }
            lastCall = now;
            return fn(...args);
        };
        */
    };

    // string reverse
    self.reverse = function(s) {
        let o;
        for (let i = s.length - 1, o = ''; i >= 0; o += s[i--]) { }
        return o;
    };

    self.chopNewline = function(s) {
        if (s.endsWith("\n")) {
            return self.chop(s);
        } else {
            return s;
        }
    };

    self.chop = function(s) {
        if (s.length > 0) {
            return s.substring(0, s.length-1);
        } else {
            return s;
        }
    };

    // depth first traversal of JSO
    self.dfs = function(obj, visitFunc, path="root") {
        visitFunc(obj, path);
        let t = self.valueType(obj);
        if (t === "object" || t === "array") {
            let keys = Object.keys(obj);
            keys.map(function(k) {
                self.dfs(obj[k], visitFunc, path + "." + k);
            });
        }
    };

    // returns hash not list so you can post-process easier
    self.getAllProperties = function(obj) {
        let props = {};
        let base = true;

        // because prototype chains get broken so easily across contexts, worrying about
        // inheritance is pointless
        do {
          let pl = Object.getOwnPropertyNames(obj);
          pl.map(function(p) {
              //if (!p.startsWith("&"))
              props[p] = base;
          });
          base = false;
        } while ((obj = Object.getPrototypeOf(obj)));

        return props;
    };

    // if hash has only one key, get key
    self.getOneKey = function(hash) {
        let keys = Object.keys(hash);
        if (keys.length === 1) {
            return keys[0];
        }
        return null;
    };

    // shallow merge
    self.merge = function(dest, src, destPrefix = "", val = null) {
        if (self.valueType(src) === 'array') {
            if (self.valueType(dest) === 'array') {
                //console.log("Merging array");
                src.map(function(i) {
                    dest.push(i);
                });

            } else {
                src.map(function(i) {
                    dest[destPrefix + i] = val;
                });

            }
        } else {
            for (let prop in src) {

                dest[destPrefix + prop] = src[prop];

            }
        }
    };


    // only add new props
    self.addMerge = function(dest, src) {
        for (let prop in src ) {
            if (self.valueType(src[prop]) === 'object') {
                //console.debug("Shallow copy of [" + prop + "]");
            }

            if (!Reflect.has(dest, prop)) {
                dest[prop] = src[prop];
            } else {
                //console.debug("Merge ignoring existing [" + prop + "]");
            }
        }
    };

    self.bind = function (obj, parent) {
        Reflect.setPrototypeOf(obj, parent);
    };

    self.wildcardMatch = function(pattern, match) {
        let find = pattern;

        find = find.replace(/[\-\[\]\/\{\}\(\)\+\.\\\^\$\|]/g, "\\$&");
        find = find.replace(/\*/g, ".*");
        find = find.replace(/\?/g, ".");
        //console.log("regex: " + find);
        let regEx = new RegExp("^" + find + "$", "i");

        return regEx.test(match);
    };

    // assumes object (hash) with comparable keys and atomic members
    // object should be flat; not reliable for nested structures (always reports changes)
    self.computeDeltaHash = function (
        oldHash,
        newHash,
        computeMatchFunc = function (x1, x2) {
            //console.log("compute delta hash default compute match func")

            if (self.valueType(x1) === "date") {
                return (x1 - x2 === 0);
            } else {
                return x1 === x2;
            }
        },
        keyFilterFunc = function(k) { return true; })
    {

        //console.log("compute delta hash")

        let x;

        if (!oldHash) {
            oldHash = {};
        }

        if (!newHash) {
            newHash = {};
        }

        let result = {};
        let resultData = {};
        let changeResult = {};

        for (x in newHash) {
            if (keyFilterFunc(x)) {
                result[x] = 'a';
                resultData[x] = newHash;
            }
        }

        for (x in oldHash) {

            if (keyFilterFunc(x)) {
                //console.debug("Looking up " + x);

                let curr = oldHash[x];
                let other = Reflect.has(newHash, x);

                if (!other) {
                    //console.debug("No other found; delete");
                    result[x] = "d";
                    resultData[x] = oldHash;
                } else {
                    //console.debug("Key match");
                    delete result[x];

                    //console.debug(curr);
                    //console.debug(other);

                    if (!computeMatchFunc(curr, newHash[x])) {
                        result[x] = "c";  // change
                        resultData[x] = newHash;
                        changeResult[x] = {
                            old: curr,
                            new: newHash[x]
                        };
                        //console.log("data did NOT matched")
                        //console.log(changeResult[x])
                    } else {
                        //console.log("data matched")
                    }

                }
            }
        }

        //console.debug(result);
        //console.debug(changeResult);

        let resultList = [];
        for (x in result) {
            let output = {};
            output.key = x;
            let hash = resultData[x];
            output.data = hash[x];
            output.delta = result[x];
            if (output.delta === 'c') {
                output.diff = changeResult[x];
            }
            resultList.push(output);
        }

        return resultList;
    };

    // compare two arrays (sets) of flat objects
    // util.computeDeltaSet([3,4,5],[3,4,5]) ==> []
    self.computeDeltaSet = function(
        oldArr,
        newArr,
        computeKeyFunc = function(x) { return x;},
        computeMatchFunc = function (x1, x2) {
            //console.log("compute delta set default compute match func")
            if (self.valueType(x1) === "date") {
                return (x1 - x2 === 0);
            } else {
                return x1 === x2;
            }
        },
        keyFilterFunc = function(k) { return true; }) {

        //console.log("compute delta set")

        let oldHash = {};
        let newHash = {};

        let x, item, key;

        if (oldArr) {
            for (x in oldArr) {
                item = oldArr[x];
                key = computeKeyFunc(item);
                //console.debug("Got key " + key);
                oldHash[key] = item;
            }
        }

        //console.debug(oldHash);

        if (newArr) {
            for (x in newArr) {
                item = newArr[x];
                key = computeKeyFunc(item);
                //console.debug("Got key " + key);
                newHash[key] = item;
            }
        }

        //console.debug(newHash);

        let result = self.computeDeltaHash(
            oldHash,
            newHash,
            computeMatchFunc,
            keyFilterFunc);

        return result;
    };

    /*
    self.computeDelta([{id:4}],"id",[{id:5}])
        [
            { key: '4', data: { id: 4 }, delta: 'd' },
            { key: '5', data: { id: 5 }, delta: 'a' }
        ]
    */
    self.computeDelta = function (oldArr, key, newArr, computeKeyFunc, computeMatchFunc)
    {
        return self.computeDeltaSet(oldArr, newArr,
            computeKeyFunc || function(x) { return x[key]; },
            computeMatchFunc || function (x1,x2) {
                //console.log("compute delta default compute match func")
                return true;
            });
    };

    // treats array elements as keys and compares them e.g. set
    // use computeDeltaSet to simply match array by order
    self.computeArrayDelta = function (oldArr, newArr)
    {
        let x;

        if (!oldArr) {
            oldArr = [];
        }

        if (!newArr) {
            newArr = [];
        }

        let newHash = {};
        for (x of newArr) {
            newHash[x] = true;
        }

        let unchanged = {};
        let delHash = {};
        for (x of oldArr) {
            if (Reflect.has(newHash,x)) {
                unchanged[x] = true;
                delete newHash[x];
            } else {
                delHash[x] = true;
            }
        }

        return {
            deleted: delHash,
            new: newHash,
            unchanged: unchanged
        };


    };

    self.TOSTRING = Object.prototype.toString;

    self.TYPES = {
        'undefined': 'undefined',
        'number': 'number',
        'boolean': 'boolean',
        'string': 'string',
        'function': 'function',  // usually async functions
        '[object Function]': 'function',
        '[object RegExp]': 'regexp',
        '[object Array]': 'array',
        '[object Date]': 'date',
        '[object Error]': 'error'
    };

    self.valueType = function (o) {
        let type = self.TYPES[typeof o] || self.TYPES[self.TOSTRING.call(o)] || (o ? 'object' : 'null');
        return type;
    };

    self.isNumeric = function(str) {
        // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        // ...and ensure strings of whitespace fail
        let val = !isNaN(str) && !isNaN(parseFloat(str));
        return val;
    };

    // may contain underscores or dashes too
    self.isAlphaNumeric = function(ch) {
        return ch.match(/^[a-z\_\-0-9]+$/i) !== null;
    };


    // may contain underscores and dots but no dashes
    self.isAlphaNumDot = function(ch) {
        return ch.match(/^[a-z\_\.0-9]+$/i) !== null;
    };

    self.isDate = function(valStr) {
        return moment(valStr, moment.ISO_8601, true).isValid();
    };

    self.isFloat = function(n) {
        if (self.isNumeric(n)) {
            return !Number.isInteger(n);
        } else {
            return false;
        }
    };

    self.formatDate = function(when) {
        if (when) {
            //return moment(when).format('YYYY-MM-DD HH:mm:ss');
            return moment(when).format('MMM DD HH:mm:ss YYYY');
        } else {
            return "";
        }
    };

    self.formatDateSimple = function(when) {
        let today = moment().startOf('day');
        if (when) {
            if (today.isSame(when, 'd')) {
                return moment(when).format('LTS');
            } else {
                return moment(when).format('ddd LTS');
            }
        } else {
            return "";
        }
    };

    self.lpad = function(num, length, padString = " ") {
        return (num + "").padStart(length, padString);
    };

    self.rpad = function(num, length, padString = " ") {
        return (num + "").padEnd(length, padString);
    };

    // WARNING: use backslash backslash dollar sign for dollar bracket prefix etc.
    // this is NOT whole word replace so be careful
    self.replace = function(oldStr, newStr, buf) {
        if (!buf || buf.length === 0) {
            return '';
        }

        let re = new RegExp(oldStr, "g");
        let outStr = buf.replace(re, newStr);
        return outStr;
    };

    self.replaceWholeWord = function(oldStr, newStr, buf) {

        if (!buf || buf.length === 0) {
            return '';
        }
        let expr="(?<=^|\\s)" + oldStr + "(?=\\s|$)";
        //let expr='\\b' + oldStr + '\\b';
        let re = new RegExp(expr, "g");
        let outStr = buf.replace(re, newStr);
        return outStr;
    };

    self.bufferToLines = function(buf) {
        if (buf && buf.replace) {
            return buf.replace(/\r\n/, "\n").split("\n");
        } else {
            return [];
        }
    };

    self.lineify = function(buf) {
        let newBuf = "\n";
        let lines = self.bufferToLines(buf);
        //newBuf += "// " + lines.length + " found in buffer\n";
        let cnt = 1;  // errors start on line 1
        for (let line of lines) {
            line = self.lpad(cnt++,5) + " " + line + "\n";
            newBuf += line;
        }
        return newBuf;
    };

    self.getLines = function(buf, startLine) {
        let lines = self.bufferToLines(buf);
        if (startLine) {
            return lines.slice(startLine).join("\n");
        } else {
            return lines;
        }
    };


    // split but also discards empties;
    // if buf.split throws error it is probably not a string
    self.split = function(buf, delim, modifierFunc) {
        let finalTokens = [];

        if (!buf || buf === '') {
            return finalTokens;
        }

        if (delim === "." || delim === "_") {
            // make sure escaped properly
            delim = "\\" + delim;
        }

        let re = new RegExp(delim);
        let tokens = buf.split(re);
        for (let i in tokens) {
            let val = tokens[i].trim();
            if (val.length > 0) {
                if (modifierFunc) {
                    val = modifierFunc(val);
                }
                finalTokens.push(val);
            }
        }
        return finalTokens;
    };

    // looking for blank line; semicolon sensitive
    self.extractToBlankLine = function(rawBuf, terminator=';') {
        let lines = self.split(rawBuf, "\n\n");
        let buffer = lines[0].trim();
        let commands = self.split(buffer, terminator);
        return commands[0];
    };

    // take first line; semicolon sensitive
    self.extractFirstLine = function(rawBuf, terminator=';') {
        let lines = self.split(rawBuf, "\n");
        if (!lines.length) {
            return '';
        }
        let buffer = lines[0].trim();
        let commands = self.split(buffer, terminator);
        return commands[0];
    };

    // extract to semicolon
    self.extractToTerminator = function(rawBuf, terminator=';') {
        let lines = self.split(rawBuf, terminator);
        if (!lines.length) {
            return '';
        }
        let buffer = lines[0].trim();
        return buffer;
    };


    self.bufferToSections = function(rawBody) {
        let lines = self.bufferToLines(rawBody);

        let sections = [];
        let currSection = null;

        let processLine = function(line,cnt) {

            //thread.console.debug("line " + cnt, line);

            if (line.startsWith("----")) {
                if (currSection) {
                    sections.push(currSection);
                }

                // extract the path stuff from between the brackets
                let lineResult = self.parseRecursive(line, "[", "]");
                let path;
                let dsl;
                //thread.console.debug("mx line result", lineResult);
                lineResult.map(function(lr) {
                    if (lr.depth === 1) {
                        let pathSection = lr.text.trim();
                        let pathParts = pathSection.split(" ");
                        path = pathParts[0];
                        dsl = pathParts[1];
                    }
                });

                currSection = {
                    line,
                    path,
                    dsl,
                    text:       ""
                };
            } else {
                if (currSection) {
                    currSection.text += line + "\n";
                } else {
                    //thread.console.info(rawPath + " ignored line " + cnt);
                }
            }
        };

        lines.map(processLine);
        // push last section
        if (currSection) {
            sections.push(currSection);
        }

        return sections;
    };

    // returns number 0..max
    self.random = function(max) {
        return Math.floor(Math.random() * max);
    };

    // in practice this does not work on root contexts
    self.clear = function(obj) {

        let i;

        for (i in obj) {
            obj[i] = undefined;
        }

        for (i in obj) {
            delete obj[i];
        }

    };

    // a zipper pairs array of keys to array of values
    self.zip = function(keys, values) {
        let output = {};
        let keyLen = keys.length;
        for (let i = 0; i < keyLen; i++) {
            output[keys[i]] = values[i];
        }
        return output;
    };

    // eval in current context
    self.getObjectByPath = function(path, doErrorIfMissing = true) {
        if (!path || (path.length === 0)) {
            if (typeof module === "undefined") {
                // assume browser
                return window;
            } else {
                // assume node
                return global;
            }

        }

        let obj;
        try {
            obj = eval("(" + path + ")");
        } catch (e) {
            // ignore
        }
        if (typeof obj === 'undefined' && doErrorIfMissing) {
            console.error("Invalid path: " + path);
            return;
        }

        return obj;
    };

    self.evalToJSO = function(buf) {

        if (!buf) {
            console.error("No code provided to eval (JSO could be NULL)");
            return;
        }

        let jso;
        try {
            jso = eval("(" + buf + ")");
        } catch (err) {
            console.log(self.lineify(buf));
            console.error(err.message);
            return;
        }

        return jso;
    };

    self.isAsyncFunction = function(func) {
        return func.toString().toLowerCase().trim().startsWith("async");
    };

    // utility to get args to a given function text; if you getting strange errors here
    // you probably declared a function inside an object w/o an attribute name: prefix;
    // result is not sorted; returns array of strings
    self.getArgs = function(origFuncStr, stripDefaults=true) {

        function $args(func) {
            let str = (func + '')
                .replace(/[/][/].*$/mg,'') // strip single-line comments
                .replace(/\s+/g, '') // strip white space
                .replace(/[/][*][^/*]*[*][/]/g, '') // strip multi-line comments
                .split(')', 1)[0].replace(/^[^(]*[(]/, ''); // extract the parameters
                //.replace(/=[^,]+/g, '') // strip any ES6 defaults


            if (stripDefaults) {
                str = str.replace(/=[^,]+/g, ''); // strip any ES6 defaults
            }

            let result = str.split(',').filter(Boolean); // split & filter [""]

            return result;
        }

        let argList = $args(origFuncStr);
        if (!argList) {
            argList = [];
        }

        //console.debug("func:" + origFunc.toString());
        //console.log("arglist", argList);
        return argList;
    };

    // tries to find a function's return token
    // takes buffer because caller usually needs to call pretty not toString
    self.getReturn= function(buf) {
        let retvar;

        // get return value; note currently ignores comments!!
        let bufLines = self.bufferToLines(buf);
        bufLines = bufLines.reverse();
        //console.log(bufLines);

        bufLines.map(function (l) {
            let x = l.indexOf("return");
            if (!retvar && (x >= 0)) {
                let tmp = l.substring(x + 6).trim();
                if(tmp) {
                    tmp = tmp.replace(/;/g, "");
                    tmp = tmp.replace(/}/g, "");
                }
                //console.info(tmp);
                retvar = tmp;
            }
        });

        if (retvar) {

            if (retvar && !self.isAlphaNumeric(retvar)){
                retvar = null;
            }

            // if it contains spaces it is surely garbage
            if (retvar && retvar.indexOf(" ")>=0) {
                retvar = null;
            }

            if (retvar && self.isNumeric(retvar)) {
                retvar = null;
            }

            if (retvar && (
                retvar === "true" ||
                retvar === "false" ||
                retvar === "null" ||
                retvar === "undefined" ||
                retvar.indexOf(".") >= 0)) {
                retvar = null;
            }


        }


        return retvar;
    };

    self.getHeader = function(buf, targetName) {
        let header = "";

        // note the leading space before the equals
        let offset = buf.indexOf(targetName + " =");
        if (offset < 0) {
            // try again without space
            offset = buf.indexOf(targetName + "=");
        }

        if (offset >= 0) {
            // save everything above the target as literal
            header = buf.substring(0, offset);
        }
        return header;
    };

    // for JSO object pathing
    self.splitPath = function(path, delim=".") {
        let tokens = self.split(path, delim);
        let leaf = tokens[tokens.length-1];
        tokens.length--;
        return {vob: tokens.join(delim), key: leaf};
    };

    // extracts keys only
    self.hashToList = function(hash) {
        let flatList = [];
        for (let x in hash) {
            let obj = hash[x];
            //obj._key = x;
            flatList.push(obj);
        }
        return flatList;
    };

    self.extractText = function(startStr, buf, end) {
        let idx = buf.indexOf(startStr);
        if (idx >= 0) {
            let subStr = buf.substring(idx + startStr.length);
            let idx2 = subStr.indexOf(end || '\n');
            if (idx2) {
                return subStr.substring(0, idx2);
            } else {
                return subStr;
            }
        }
    };

    self.unquote = function(str) {
        if (str[0] === "'" && str[str.length-1] === "'") {
            return str.substring(1,str.length-1);
        }
        if (str[0] === "\"" && str[str.length-1] === "\"") {
            return str.substring(1,str.length-1);
        }
        return str;

    };

    // takes hash of objects and turns values into array
    // util.hashPivot({foo: true, x:39}) => [ true, 39 ]
    self.hashPivot = function(hash) {
        let flatList = [];
        for (let x in hash) {
            //let obj = {};
            let obj = hash[x];
            //obj._key = x;
            flatList.push(obj);
        }
        return flatList;
    };

    // util.objectToTable({foo: true, x:39}) => [ { foo: true }, { x: 39 } ]
    // more accurately called object to array
    self.objectToTable = function(obj) {
        let tab = [];
        Object.keys(obj).map(function(k) {
            let newObj = {};
            newObj[k] = obj[k];
            tab.push(newObj);
        });
        return tab;
    };

    // generates curried func
    self.genDateCompare = function(dateColName) {
        return function(a,b) {
            let zeroDate = new Date(1970,1,1).getTime();
            let dateA = a[dateColName];
            let dateB = b[dateColName];

            if (!dateA) {
                dateA = zeroDate;
            } else {
                dateA = dateA.getTime();
            }

            if (!dateB) {
                dateB = zeroDate;
            } else {
                dateB = dateB.getTime();
            }

            //console.log("A: " + dateA);
            //console.log("B: " + dateB);


            if (dateA > dateB) {
                //console.log("A date bigger");
                return -1;
            }

            if (dateA < dateB) {
                //console.log("B date bigger");
                return 1;
            }

            //console.log("dates match");
            return 0;
        };
    };

    // sort array by Date in given date col; orig array is MODIFIED
    // returns latest LAST
    self.sortByDate = function(arr, dateColName) {
        arr.sort(self.genDateCompare(dateColName));
        arr.reverse();
    };

    // returns latest FIRST
    self.sortByDateReverse = function(arr, dateColName) {
        arr.sort(self.genDateCompare(dateColName));

    };

    self.sortChar = function(arr, sortCol) {
        arr.sort(function(a,b) {
            if (a[sortCol] < b[sortCol]) {
                return -1;
            }

            if (a[sortCol] > b[sortCol]) {
                return 1;
            }

            return 0;
        });
    };

    self.sortCaseInsensitive = function(arr) {
        arr.sort(function(a,b) {
            a = a.toLowerCase();
            b = b.toLowerCase();
            if (a === b) return 0;
            return a < b ? -1: 1;
        });
    };

    self.sortNumeric = function(arr, numCol) {
        arr.sort(function(a,b) {
            a = a[numCol];
            b = b[numCol];
            if (a === b) return 0;
            return a < b ? -1: 1;
        });
    };

    self.zipMerge = function(outputList, attrName, sourceList) {
        if (outputList.length === 0) {
            sourceList.map(function(arrItem) {
                let obj = {};
                obj[attrName] = arrItem;
                outputList.push(obj);
            });
        } else if (outputList.length !== sourceList.length) {
            console.error("Output list length does not match source (" + outputList.length + " != " + sourceList.length + ")");
        } else {
            let x = 0;
            outputList.map(function(obj) {
                obj[attrName] = sourceList[x++];
            });
        }
    };

    // obj array to hash [{x:7},{y:8}] => {x: {x:7}, y: {y:8}}
    // basically creates a unique key index on a given set of rows
    /*
    self.arrayToHash = function(arr, key) {
        return lodash.keyBy(arr, key);
    };
    */

    // just calls above
    self.index = function(arr, key) {
        return self.arrayToHash(arr, key);
    };

    // takes array of dir tokens; returns leaf
    self.fillObjPath = function(start, objPath, fill=true) {
        if (!start) {
            console.error("Invalid fill start");
        }

        if (!objPath) {
            console.error("Invalid fill object path");
        }

        let curr = start;
        objPath.map(function(node) {
            let next = curr[node];
            if (!next) {
                if (fill) {
                    next = curr[node] = {};
                } else {
                    console.error("Invalid path: " + objPath.join("."));
                }
            }
            curr = next;
        });
        return curr;
    };

    // trim text but throw ellipsis at end if too long
    self.trimText = function(text, maxStringLen) {
        if (!text) {
            return "";
        }
        if (!maxStringLen) {
            maxStringLen = 100;
        }

        let buf = text.substring(0,maxStringLen);
        if (text.length > maxStringLen) {
            buf += "...";
        }

        return buf;
    };

    self.preview = self.trimText;

    // takes string path (goes to entire length)
    self.fillPath = function(start, refPath, fill=true, delim=".") {
        let tokens = self.split(refPath, delim);
        return self.fillObjPath(start, tokens, fill);
    };

    // object path not file path; recommend do eval in context instead
    self.findPath = function(start, filePath, delim = ".") {
        let tokens = self.split(filePath,delim);
        let target = tokens[tokens.length-1];
        if (!target) {
            //console.warn("findPath: No target found");
            return null;
        }
        let targetExt = pathLib.extname(target);
        tokens[tokens.length-1] = pathLib.basename(target, targetExt);
        let cursor = start;
        tokens.map(function(node) {
            node = self.replace("%",".", node);
            //console.debug("findPath: " + node, cursor);

            if (cursor)
                cursor = cursor[node];
            else {
                //console.warn("findPath: Dead end");
            }

        });
        return cursor;
    };

    // /foo/bar/blah.txt returns blah
    self.getBaseName = function(thePath) {

        thePath = thePath.replace(/\s/g,"_");

        thePath = self.replace("/",".",thePath);

        let segs = thePath.split(".");

        if (!segs.length) {
            // something bad happened
            return;
        }

        if (segs.length === 1) {
            return segs[0];
        }

        let root = segs[segs.length-2];
        let extName = segs[segs.length-1];
        return root;
    };

    // contains leading dot
    self.getExt = function(thePath) {
        return pathLib.extname(thePath);
    };

    // does not contain leading dot
    self.getDsl = function(thePath) {
        let extName = self.getExt(thePath);
        if (extName.startsWith(".")) {
            extName = extName.substring(1);
        }
        return extName;
    };

    // acts same way as DSL
    self.getLastSeg = function(thePath) {
        if (!(thePath.indexOf(".")>=0)) {
            return thePath;
        }
        return self.getDsl(thePath);
    };

    self.normalizePath = function(thePath) {
        thePath = self.replace("/",".",thePath);

        let segs = thePath.split(".");

        // push root on
        if (!segs.length || !(segs[0] === 'root')) {
            segs.unshift("root");
        }

        return segs.join(".");
    };


    self.removeLastSeg = function(thePath) {
        thePath = self.normalizePath(thePath);

        let segs = thePath.split(".");

        if (segs.length === 1) {
            return ".";  // return current
        }

        segs.length--;
        return segs.join(".");
    };

    // use this w console.table; note cols array can have headings
    // console.table(util.select(lintMessages, ["ruleId Rule", "line Line", "message Message"]));
    self.select = function(arr, colsArray) {
        let outArray = [];
        arr.map(function(item) {
            let obj = {};
            colsArray.map(function(c) {
                let tokens = c.trim().split(" ");
                if (tokens.length > 1) {
                    obj[tokens[1]] = item[tokens[0]];
                } else {
                    obj[c] = item[c];
                }
            });
            outArray.push(obj);
        });
        return outArray;
    };

    self.where = function(obj, clause) {
        let result = {};
        Object.keys(obj).map(function(key) {
            let row = obj[key];

            let t = self.valueType(row);
            if (t=== "object") {

            } else if (t=== "array") {

            } else {
                let str = `
                    let $val = ${row};
                    if (` + clause + `) {
                        true;
                    } else {
                        false;
                    }
                `;
                let ret = eval(str);

                if (ret) {
                    result[key] = obj[key];
                }
            }

        });
        return result;
    };

    self.getFunctions = function(target) {

        let funcs = {};
        Object.keys(target).map(function(targetName) {

            let obj = target[targetName];
            let t = self.valueType(obj);

            if (t === 'function') {
                funcs[targetName] = obj;
            }
        });

        return funcs;
    };

    // extract given (single) col from array of JSON to simple array
    /*
    self.extract = function(arr, col) {

        let outputList = [];
        lodash.forEach(arr, function(row) {
            outputList.push(row[col]);
        });
        return outputList;
    };
    */

    self.matchString = function(match, actual) {
        if (match.endsWith('%')) {
            return actual.indexOf(match.substring(0, match.length-1)) >= 0;
        } else {
            return match === actual;
        }
    };

    // JSO matcher returns true or false; assumes flat (splayed) structures
    /*
    filter = {
        sender:     ["start"],
        event:      ["add","change"]
    };

    */
    self.match = function(target, filterSpec) {

        let matchCnt = 0;
        let totalCnt = 0;

        //console.debug("Checking filter " + j);

        let matchList = filterSpec;
        for (let k in matchList) {
            totalCnt++;
            //console.debug("Checking match " + k);

            let actualVar = target[k];
            let matchVar = matchList[k];

            //console.debug("Checking [" + k + "]:" + actualVar + " <--> " + matchVar, actualVar);

            if (self.valueType(actualVar) === "object") {
                console.error("Actual [" + k + "] cannot be object; must flatten first");
            }

            if (matchVar === "#any") {
                // match any value
                if (actualVar) {
                    matchCnt++;
                }

            } else {

                let matchRes;
                if (typeof matchVar === 'string') {
                    try {
                        matchRes = self.matchString(matchVar, actualVar);
                    } catch (serr) {
                        console.error("Match failed: " + serr, matchVar);
                    }
                } else {
                    matchRes = matchVar === actualVar;
                }

                if (matchRes) {
                    matchCnt++;
                } else {

                    let mtv = self.valueType(matchVar);
                    if (mtv === 'array') {
                        //console.debug("Converting match array to hash");
                        // convert to hash
                        let matchHash = {};
                        for (let l of matchVar) {
                            matchHash[l] = true;
                        }
                        matchList[k] = matchVar = matchHash;
                        mtv = 'object';
                    }

                    if (mtv === 'object') {
                        //console.debug("Checking match hash for " + actualVar);
                        //console.debug(matchVar);
                        if (matchVar[actualVar]) {
                            //console.debug("Got match hash for " + actualVar);
                            matchCnt++;
                        }
                    } else {
                        // no match; done
                        break;
                    }
                }
            }
        }

        if (matchCnt === totalCnt) {
            return target;
        } else {
            return false;
        }
    };

    self.mapArgObject = function(params, obj) {

        //console.log("Params: " + params);

        let newObj = {};
        params.map(function(p) {

            if (p.indexOf("=")>0) {
                let toks = p.split("=");
                if (toks.length > 1) {
                    let lhs = toks[0].trim();
                    let rhs = toks[1].trim();

                    newObj[lhs] = obj[rhs];
                } else {
                    newObj[p] = obj[p];
                }
            } else {
                if (Reflect.has(obj, p)) {
                    newObj[p] = obj[p];
                } else {
                    //throw("Unable to resolve parameter [" + p + "]");
                }
            }
        });

        return newObj;
    };

    self.mapArgs = function(params, actualParams, obj) {

        let newObj = self.mapArgObject(params, obj);

        let args = [];

        //console.log("map args");
        //console.log(obj);

        actualParams.map(function(ap) {
            args.push(newObj[ap]);
        });

        //console.log("Map args returning: " + args);
        return args;
    };

    // obj contains params
    self.applyObjectElements = async function(func, obj, errFunc, contextObj) {

        let params = self.getArgs(func);  // in case there are ES6 defaults at play
        //console.log("util apply params: " + params);

        let args = self.mapArgs(params, params, obj);
        //console.log("util apply args: " + args);

        //console.log("util apply arg object:");
        //console.log(obj);

        let retval;
        try {
            retval = await func.apply(contextObj, args);
        } catch (err) {
            if (errFunc) {
                retval = await errFunc(err, obj);
            } else {
                throw err;
            }
        }
        //console.log(retval);
        return retval;
    };

    self.parseRecursive = function(argBuf, startPattern, endPattern, maxDepth=999) {

        let matchRecursive = function () {
            let formatParts = /^([\S\s]+?)\.\.\.([\S\s]+)/;
            let metaChar = /[-[\]{}()*+?.\\^$|,]/g;
            let escape = function (str) {
                return str.replace(metaChar, "\\$&");
            };

            return function (str, format) {
                let p = formatParts.exec(format);
                if (!p) throw new Error("format must include start and end tokens separated by '...'");
                if (p[1] === p[2]) throw new Error("start and end format tokens cannot be identical");

                let	opener = p[1];
                let	closer = p[2];

                    /* Use an optimized regex when opener and closer are one character each */
                let iterator = new RegExp(format.length === 5 ? "["+escape(opener+closer)+"]" : escape(opener)+"|"+escape(closer), "g");
                let	results = [];
                let openTokens, matchStartIndex, match;

                do {
                    openTokens = 0;
                    while (match === iterator.exec(str)) {
                        if (match[0] === opener) {
                            if (!openTokens)
                                matchStartIndex = iterator.lastIndex;
                            openTokens++;
                        } else if (openTokens) {
                            openTokens--;
                            if (!openTokens) {
                                let obj = {
                                    leftIdx: matchStartIndex - p[1].length,
                                    left: str.substring(0, matchStartIndex - p[1].length),
                                    middle: str.slice(matchStartIndex, match.index),
                                    middleIdx: match.index,
                                    right: str.substring(match.index + p[2].length),
                                    rightIdx: match.index + p[2].length
                                };

                                results.push(obj);
                                //results.push(str.slice(matchStartIndex, match.index));
                            }
                        }
                    }
                } while (openTokens && (iterator.lastIndex = matchStartIndex));

                return results;
            };
        }();

        let result = [];
        let driver = function(buf, depth) {

            let arr = matchRecursive(buf, startPattern + "..." + endPattern);
            if (!arr.length) {

                if (buf.indexOf(startPattern)>=0) {
                    throw new Error("End token mismatch");
                }

                if (buf.indexOf(endPattern)>=0) {
                    throw new Error("Start token mismatch");
                }

                result.push({
                    depth: depth,
                    text: buf
                });


                return;
            }

            let row = arr[0];

            if (row.left.indexOf(startPattern)>= 0) {
                driver(row.left, depth);
            } else {
                result.push({
                    depth: depth,
                    text: row.left,
                    leftIdx: row.leftIdx,
                    middleIdx: row.middleIdx,
                    rightIdx: row.rightIdx
                });

            }

            if (row.middle.indexOf(startPattern)>= 0 && depth < maxDepth-1) {
                driver(row.middle, depth+1);
            } else {
                result.push({
                    depth: depth+1,
                    text: row.middle,
                    leftIdx: row.leftIdx,
                    middleIdx: row.middleIdx,
                    rightIdx: row.rightIdx
                });

            }

            if (row.right.indexOf(startPattern)>= 0) {
                driver(row.right, depth);
            } else {
                result.push({
                    depth: depth,
                    text: row.right,
                    leftIdx: row.leftIdx,
                    middleIdx: row.middleIdx,
                    rightIdx: row.rightIdx
                });

            }

        };

        let entryPoint = function(buf) {
            try {
                driver(buf,0);
            } catch (err) {
                if (err.message === "End token mismatch") {
                    // keep adding endings until it works
                    entryPoint(buf + endPattern);
                }
            }
        };

        // builds table of [depth, text] chunks; text may be blank
        entryPoint(argBuf);

        let keyStack = [];
        let groupIdx = 0;
        result.map(function(r) {
            if (r.depth > (keyStack.length-1)) {
                r.group = groupIdx;
                keyStack.push(groupIdx);
                groupIdx++;
            } else if (r.depth < (keyStack.length-1)) {
                keyStack.pop();
                r.group = keyStack[keyStack.length-1];
            } else {
                r.group = keyStack[keyStack.length-1];
            }
        });

        // need to rewrite all this shit

        /*
        let plan = {};
        result.map(function(r) {
            if (plan[r.group]) {
                plan[r.group] += (r.text || "");
            } else {
                plan[r.group] = (r.text || "");
            }
        });
        */

        return result;
    };


    self.isEmail = function(mail) {
        return (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail));
    };

    // object to buffer done in pretty module


    self.colorNameToHex = function(color) {
        let colors = self.getColors();

        if (color.startsWith("#")) {
            return color;
        }

        if (typeof colors[color.toLowerCase()] !== 'undefined')
            return colors[color.toLowerCase()];

        console.error('Bad color name: ' + color);
        return false;
    };

    self.colorIsHex = function(hex) {
        return (/^([A-Fa-f0-9]{3}){1,2}$/.test(hex));
    };

    self.colorLuminance = function(hex, lum) {

        // validate hex string
        hex = String(hex).replace(/[^0-9a-f]/gi, '');
        if (hex.length < 6) {
            hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        }
        lum = lum || 0;

        // convert to decimal and change luminosity
        let rgb = "#", c, i;
        for (i = 0; i < 3; i++) {
            c = parseInt(hex.substr(i*2,2), 16);
            c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
            rgb += ("00"+c).substr(c.length);
        }

        return rgb;
    };

    self.hexToRGBA = function (hex, opacity){
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length=== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',' + opacity + ')';
        }
        console.error('Bad hex color: ' + hex);
    };

    self.dataUriToBuffer = function(uri) {
      if (!/^data\:/i.test(uri)) {
        throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
      }

      // strip newlines
      uri = uri.replace(/\r?\n/g, '');

      // split the URI up into the "metadata" and the "data" portions
      let firstComma = uri.indexOf(',');
      if (-1 === firstComma || firstComma <= 4) throw new TypeError('malformed data: URI');

      // remove the "data:" scheme and parse the metadata
      let meta = uri.substring(5, firstComma).split(';');

      let type = meta[0] || 'text/plain';
      let typeFull = type;
      let base64 = false;
      let charset = '';
      for (let i = 1; i < meta.length; i++) {
        if ('base64' === meta[i]) {
          base64 = true;
        } else {
          typeFull += ';' + meta[i];
          if (0 === meta[i].indexOf('charset=')) {
            charset = meta[i].substring(8);
          }
        }
      }
      // defaults to US-ASCII only if type is not provided
      if (!meta[0] && !charset.length) {
        typeFull += ';charset=US-ASCII';
        charset = 'US-ASCII';
      }

      // get the encoded data portion and decode URI-encoded chars
      let data = unescape(uri.substring(firstComma + 1));

      let buffer;
      if (base64) {
          // @ts-ignore
          buffer = Buffer.from(data, 'base64');
      } else {
          // @ts-ignore
          buffer = Buffer.from(data, 'ascii');
      }

      // set `.type` and `.typeFull` properties to MIME type
      buffer['type'] = type;
      buffer['typeFull'] = typeFull;

      // set the `.charset` property
      buffer['charset'] = charset;

      return buffer;
    };

    self.cons = function(head, tail) {
        if (self.valueType(tail) !== 'array') {
            // error
            return tail;
        }
        if (self.valueType(head) !== 'array') {
            tail.unshift(head);
            return tail;
        } else {
            return head.concat(tail);
        }
    };

    self.getPivotInfo = function(sourceDir, pivotSeg) {

        // we want to pivot on a segment called 'src' if possible
        let sourceSegs = sourceDir.split(pathLib.sep);

        // try to find topmost folder called 'src'
        let upstream = [];
        let downstream = [];
        let found = false;
        sourceSegs.map(function(seg) {
            if (!found) {
                found = (seg === pivotSeg);
            }

            if (!found) {
                upstream.push(seg);
            } else {
                downstream.push(seg);
            }
        });

        if (found) {
            //thread.console.debug("Found pivot");
        } else {
            //thread.console.softError("Unable to find src pivot");
            upstream = [sourceSegs[0]];
            downstream = [];
        }

        return {
            upstream,
            downstream,
            found
        };

    };

    // pivot seg = "src", pivot peer = "lib"
    self.getMirrorPath = function(path, pivotSeg, pivotPeerSeg) {

        //console.log("path orig: " + path);
        path = self.replace("\\.", pathLib.sep, path);
        //console.log("path final: " + path);

        let pivotInfo = self.getPivotInfo(path, pivotSeg);

        //console.log("pivot info");
        //console.log(pivotInfo);

        pivotInfo.downstream.shift();  // remove pivot seg
        pivotInfo.downstream.pop();  // remove filename

        //thread.console.debug("pivot info popped", pivotInfo);

        let mirrorPath = "";
        if (pivotInfo.upstream.length > 0) {
            mirrorPath += pivotInfo.upstream.join(pathLib.sep) + pathLib.sep;
        }
        mirrorPath += pivotPeerSeg + pathLib.sep;
        if (pivotInfo.downstream.length > 0) {
            mirrorPath += pivotInfo.downstream.join(pathLib.sep) + pathLib.sep;
        }

        return mirrorPath;
    };

    self.sleep = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    // this is a bunch of crap yes we know
    self.getColors = function() {
        return {"aliceblue":"#f0f8ff","amber":"#ff9000","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
        "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
        "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
        "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#333333","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
        "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
        "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#666666","dodgerblue":"#1e90ff",
        "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff","fancygrey":"#666666","fancyred":"#d82b11",
        "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f","greenscreen":"#6AC085",
        "honeydew":"#f0fff0","hotpink":"#ff69b4",
        "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
        "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
        "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
        "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
        "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
        "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
        "navajowhite":"#ffdead","navy":"#000080",
        "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
        "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","pre":"#6666ff","purple":"#800080",
        "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
        "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","softamber":"#dd7d00","springgreen":"#00ff7f","steelblue":"#4682b4","strgreen":"#00dd00",
        "tan":"#d2b48c","teal":"#008080","terminal":"#89F8FB","terminalgreen":"#34BC26","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
        "violet":"#ee82ee","medblue":"#058eff","deepaqua":"#05ffc4","lightteal":"#00c4aa",
        "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5","lounge":"#cc00dd",
        "yellow":"#ffff00","mellowyellow":"#cccc00", "yellowgreen":"#9acd32"};
    };

};

let util = new Util();

module.exports = { singleton: util };

/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */


let vm = require('vm');


let ThreadManager = require("../selftyped/Thread").manager;

let Delta = require("../untyped/UnsafeDelta").class;

let util = require("../untyped/Util").singleton;

let validate = require("../selftyped/Validate").singleton;

// global counter for debugging
let _boardCnt = 1;



// the board is the basic navigational unit; basically a JS object (JSO)
let UnsafeBoard = function (boardThread, targetName="exports", target={}, parentBoard, ownerConsole, pathSeg="root", mountInstance=null) {
    let self = this;

    //validate.thread(thread);

    self.mountInstance = mountInstance; // needs to be passed in if created by mount instance

    self.proxies = {};       // proxy stuff

    self.triggers = {};      // trigger stuff


    // eslint-disable-next-line no-undef
    self.boardId = _boardCnt++;

    //thread.console.debug("Created board " + self.boardId);

    let delta = new Delta(boardThread);

    self.parent = parentBoard;
    if (parentBoard) {
        self.root = parentBoard.root;
    } else {
        self.root = self;
    }
    self.pathSeg = pathSeg;

    // use this whenever loading data or setting members
    self.getEffectiveParent = function() {
        if (self.parent)
            return self.parent
        else
            return self;
    }

    // WARNING: the path crap here is different format that
    // what it stored in database because it was written much
    // earlier -- so it uses stuff like explicit root, slashes instead of dots etc.
    // it was originally done to hopefully make UNIX-like navigation easier (e.g. cd ../foo)

    // returns abs path to root as ARRAY; use targetname for regular path
    self.getRealPath = function() {
        let result = [];
        let currBoard = self;
        while (currBoard) {
            result.push(currBoard.pathSeg);
            currBoard = currBoard.parent;
        }
        return result.reverse();
    };

    // will eventually replace targetname
    self.getPath = function(sep='/') {
        let rp = self.getRealPath();
        rp.shift();
        return rp.join(sep);
    };

    // meta stuff loaded when mounted; root boards only
    self.types = {};


    /*************/
    /* CODE AREA */
    /*************/

    const rootEnv = {};


    self.codeArea = vm.createContext(rootEnv);  // root
    self.targetName = targetName;

    self.shortTargetName = function() {
        if (self.targetName === 'root')
            return '';
        else {
            return self.targetName.replace(/^root\//,'');
        }
    };

    // codeArea is where functions run
    // code target is the interactive board
    let tgt = self.codeArea.exports = vm.createContext(target);  // interactive eval target


    // board conflicts are okay at root and if you know what you are doing but
    // too many conflicts suggests you are trying to mess up an existing board
    /*
    if (parentBoard) {
        self.codeArea.common = parentBoard.codeArea.common;
        if (tgt.common && self.parent) {
            console.warn("Board conflict with console");
        } else {
            tgt.common = parentBoard.codeArea.common;
        }

    } else {
        let foo = {};
        self.codeArea.common = foo;
        if (tgt.common && self.parent) {
            console.warn("Board conflict with console");
        } else {
            tgt.common = foo;
        }
    }
    */

    if (ownerConsole) {
        // use external console
        self.codeArea.console = ownerConsole;
        if (tgt.console && self.parent) {
            console.warn("Board conflict with console");
        } else {
            tgt.console = ownerConsole;
        }

    } else {
        // use thread console
        self.codeArea.console = boardThread.console;
        if (tgt.console && self.parent) {
            console.warn("Board conflict with console");
        } else {
            tgt.console = boardThread.console;
        }
    }

    self.codeArea._vm = vm;  // required for delta comps

    self.doRequire = function (thread, x) {
        validate.thread(thread);
        //return requireLib.require(thread, x);
        thread.console.warn("Require: " + x);
        return module.require(x);
    };
    self.codeArea.require = function(x) {
        return self.doRequire(boardThread, x);
    };
    if (tgt.require && self.parent) {
        console.warn("Board conflict with require");
    } else {
        tgt.require = function(x) {
            return self.doRequire(boardThread, x);
        };
    }

    if (tgt.module) {
        console.warn("Board conflict with module");
    } else {
        tgt.module = require("module");
    }

    // need to check for conflicts here too

    self.codeArea.setTimeout = setTimeout;
    tgt.setTimeout = setTimeout;

    self.codeArea.clearTimeout = clearTimeout;
    tgt.clearTimeout = clearTimeout;

    self.codeArea.setInterval = setInterval;
    tgt.setInterval = setInterval;

    self.codeArea.clearTimeout = clearTimeout;
    tgt.clearTimeout = clearTimeout;

    self.getCodeArea = function() {
        return self.codeArea;
    };

    self.getCodeTarget = function() {
        // force referencing
        return self.codeArea['exports'];
    };


    self.codeArea.self = self.getCodeTarget();
    if (tgt.self && self.parent) {
        console.warn("Board conflict with self");
    } else {
        tgt.self = self.getCodeTarget();
    }

    // thread is only enabled if running tacit or pointfree
    //self.codeArea.thread = self.getCodeTarget();
    // thread has no meaning outside of a function
    //tgt.thread = self.getCodeTarget();

    self.codeArea.root = self.root.getCodeTarget();
    if (tgt.root && self.parent) {
        console.warn("Board conflict with root");
    } else {
        tgt.root = self.root.getCodeTarget();
    }

    if (self.parent) {
        self.codeArea.parent = self.parent.getCodeTarget();
        if (tgt.parent) {
            console.warn("Board conflict with parent");
        } else {
            tgt.parent = self.parent.getCodeTarget();
        }
    }

    self.harness = null;


    // hide RESERVED WORDS
    let hideSet = [
        "console",
        "require",
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "self",
        "parent",
        "root",
        "shell",
        "_async",
        "_last",
        "_prior",
        "common",
        "system"
    ];

    self.hideItem=function(thread, item) {

        if (Object.isExtensible(tgt)) {
            Object.defineProperty(tgt, item, {
                enumerable: false,
                writable: true
            });
        } else {
            // this can happen if trying to create board on external transient JS object
            thread.console.warn("Target not extensible or conflict: " + item);
        }

        if (Object.isExtensible(self.codeArea)) {
            Object.defineProperty(self.codeArea, item, {
                enumerable: false,
                writable: true
            });
        } else {
            thread.console.warn("codeArea not extensible");
        }

    };

    // you must hide or else delta will try to delete stuff like console and util !!
    hideSet.map(function (k) {
        self.hideItem(boardThread, k);
    });

    self.getCodeFunctions = function() {
        return util.getFunctions(self.getCodeTarget());
    };

    // run single command; the async stuff is currently ignored by runInContext
    // do NOT use this for parsing objects unless using a temp board
    // will preserve col order
    self.run = function(thread, buf) {
        //validate.thread(thread);

        //thread.console.debug("Running board " + self.boardId);

        try {
            // note we load bulk in the code area ROOT but run in the code area TARGET
            let result = vm.runInContext(buf, self.getCodeTarget(),{displayErrors: true, timeout: 30000});
            return result;

        } catch (err) {

            thread.console.debug("board run buffer");
            thread.console.debug(util.lineify(buf));
            let errorLine = util.getErrorLine(err);
            if (errorLine) {
                let errLine = "See line " + errorLine;
                thread.console.softError(errLine);
                throw new Error(errLine + "\n" + err.toString());
            } else {
                // rethrow
                throw err;
            }

        }

    };

    self.runObject = async function(thread, objBuf) {
        validate.thread(thread);

        let startOffset = objBuf.indexOf("{");
        if (startOffset > 0)
            objBuf = objBuf.substring(startOffset);

        let endOffset = objBuf.lastIndexOf("}");
        if (endOffset > 0) {
            objBuf = objBuf.substring(0, endOffset+1);
        }

        //thread.console.debug("Running object buffer " + objBuf);
        let o = await self.run(thread, "(" + objBuf + ")");
        //thread.console.debug("obj result", o);

        return o;
    };

    // load individual commands or a single proc
    // this is usually reserved for root loads e.g. from persistence; otherwise loadObject or loadFunc is used
    // note the inability to provide a seg name
    // buf is usually a SPLAY otherwise it is an object
    self.loadBulk = function(thread, buf, sourceName="exports", filterMask=null, isSplay=true, errFunc) {
        validate.thread(thread);

        let newSplay;
        let newObj;
        let bt = util.valueType(buf);
        let currSplay;
        if (bt === "string") {
            thread.console.debug("Loading bulk at [" + sourceName + "] as a splay");

            // SPLAY

            let codeArea = self.getCodeArea();
            let codeTarget = self.getCodeTarget();

            // take before snapshot
            currSplay = delta.splayObject(codeTarget);

            //thread.console.debug("loadBulk currSplay", currSplay);
            //thread.console.debug("loadBulk replacing", sourceName);

            //thread.console.debug("loadBulk buf before", buf);

            // load splay into temp area
            codeArea._tmp = null;
            // ONLY REPLACE FIRST OCCURENCE !!
            buf = buf.replace(sourceName, "_tmp");

            //thread.console.debug("loadBulk buf after", buf);

            // if this contains only code, it will be run immediately
            // have to assume some pentester will hack their way out
            try {
                vm.runInContext(buf, codeArea);
            } catch (err) {

                // error; for now we notify everyone and their aunt

                thread.console.debug("error", Object.keys(err));
                let trimBuf = buf.substring(0,5000);  // only print first 5K chars
                let lbuf = util.lineify(trimBuf);
                thread.console.debug(lbuf);

                let errorLine = util.getErrorLine(err);
                let errorStr = err.toString();
                if (errorLine) {
                    thread.console.softError(errorStr);
                    thread.console.softError(err.toString());
                    thread.console.softError("See line " + errorLine, err);
                }

                if (errFunc) {
                    errFunc("See line " + errorLine + "\n" + errorStr);
                } else {
                    thread.console.error("No error callback provided: " + errorStr);
                }
            }

            //thread.console.debug("loadBulk codearea", codeArea);

            // now convert to real object
            newObj = codeArea._tmp;
        } else if (bt === "object"){
            // ALREADY OBJECT
            newObj = buf;
        } else {
            thread.console.error("Invalid loadBulk type: " + bt);
        }

        if (isSplay) {
            thread.console.debug("Using existing splay");
            newSplay = newObj; // already a splay

            if (!newSplay)
                thread.console.error("Invalid splay");

        } else {
            thread.console.debug("Splaying object");
            newSplay = delta.splayObject(newObj);
        }

        //thread.console.debug("newSplay", newSplay);

        // clean up dates
        Object.keys(newSplay).map(function(sk) {
            let item = newSplay[sk];
            //thread.console.debug("board loadbulk - checking [" + item.value + "] for date");
            if (item.isDate) {
                item.value = new Date(item.value);

            }
        });

        // returns delta
        let del;
        try {
            del = self.loadSplay(thread, currSplay, newSplay, filterMask);
        } catch (err) {
            if (errFunc)
                errFunc(err);
            thread.console.error(err);
        }
        return del;
    };

    // load individual commands or a single proc
    self.loadSplay = function(thread, currSplay, newSplay, filterMask=null) {
        validate.thread(thread);

        //thread.console.debug("loadSplay codearea", newSplay);

        let codeArea = self.getCodeArea();
        let codeTarget = self.getCodeTarget();

        if (!currSplay)
            currSplay = delta.splayObject(codeTarget);

        // apply diffs
        let deltaList = delta.getDeltaSplay(currSplay, newSplay, filterMask);

        delta.attachComputations('exports', deltaList);

        codeArea._sandbox = {};

        codeArea._ctx = null;

        //thread.console.debug("loadSplay deltalist", deltaList);
        //thread.console.debug("loadSplay applying computations");
        delta.applyComputations(deltaList, codeArea);
        //thread.console.info("loadSplay codeArea after computations", self.getCodeArea());

        // rebind causes 'native code' func thingy

        delete codeArea._ctx;
        delete codeArea._sandbox;
        delete codeArea._tmp;

        return deltaList;
    };

    // func must be embedded in exports wrapper
    self.loadFunc = function(thread, buf, funcName, errFunc) {
        validate.thread(thread);

        // note we take the given funcName and ignore whatever name assigned
        // in the buffer

        buf = buf.trim();

        // grab header
        let header = util.getHeader(buf, "exports");
        if (header) {
            //thread.console.debug("Board loadFunc() found header:\n" + header);
            buf = buf.substring(header.length);
        }

        if (!buf.startsWith("exports")) {
            buf="exports="+buf;
        }

        let dest = self.getCodeTarget();
        //let prior = dest[funcName];

        let tmpBoard = new UnsafeBoard(thread, self.targetName,{},null,ownerConsole, null, self.mountInstance);
        // need this next line or else...?
        tmpBoard.getCodeArea().self = self.getCodeTarget();

        //thread.console.debug("loadFunc tmpBoard codeArea before loadBulk", tmpBoard.getCodeArea());
        tmpBoard.loadBulk(thread, buf, "exports", null, false, errFunc);
        //thread.console.debug("loadFunc tmpBoard codeArea after loadBulk", tmpBoard.getCodeArea());

        let src = tmpBoard.getCodeTarget();

        // could be func or object (if async)
        if (!src) {
            // nothing was found... period; usually happens if exports prefix is missing
            let msg = "Unable to find function (no target found)";
            if (errFunc)
                errFunc(msg)
            else {
                thread.console.softError(msg);
            }
            return;
        }

        let f = dest[funcName] = src;

        f.header = header;
        f.params = util.getArgs(f);
        f.isAsync = util.isAsyncFunction(f);

        if (!f.retvar) {
            thread.console.debug("No return value found for [" + funcName + "]");
        }

        //thread.console.debug("function params", f.params);

        return true;
        //console.debug("func", dest);
    };

    self.extractSelfTypes = function(thread, buf, regex) {

        // extract all dot function stuff

        // extract all dot stuff
        //let regex = /self(\.[A-Za-z\_]+)+/g;
        let result = buf.match(regex);

        let items = {};
        if (!result) {
            // also happens if file has no self references
            //thread.console.warn("No types found for " + regex);
            return items;
        }

        result.map(function(item) {
            //thread.console.info(item);
            let key = item.substring(5); // remove self
            // need to support variadic args
            key = util.replace('[.][.][.]','_elip_', key);
            //thread.console.info(key);

            items['self.' + key] = null;
        });

        return items;
    };


    // obj *cannot* be a function def; this loads into board at member objName
    // and attempts to merge if object already there;
    // THIS WILL SORT COLS; use run() if you don't want that
    // sourceBuf must be of the form "exports = {...}"
    self.loadObject = function(thread, sourceBuf, objName="exports", errFunc) {
        validate.thread(thread);

        if (!errFunc) {
            //thread.console.debug("setting default error handler");
            errFunc = function(msg) {
                if (util.valueType(msg) === 'string')
                    throw new Error(msg);
                else
                    throw new Error("Unknown error");
            }
        }


        // convert from require format just in case
        if (util.valueType(sourceBuf) != 'string') {
            thread.console.softError("Must pass string buffer arg to board loadObject()");
            return;
        }
        sourceBuf = sourceBuf.replace("module.exports","exports");

        // resolve self references
        thread.console.debug("Looking for self refs");
        let regex = /self(\.[A-Z0-9a-z\_]+)+/g;
        let refs = self.extractSelfTypes(thread, sourceBuf, regex);
        //thread.console.debug("self refs", refs);

        let dummyBuf = sourceBuf;
        Object.keys(refs).map(function(k) {
            // replace self with dummy strings to get thru 1st pass
            //thread.console.debug("Replacing self reference for [" + k + "]");
            dummyBuf = util.replace(k,'\"' + k + '\"', dummyBuf);
        });

        let srcBoard = new UnsafeBoard(thread,"src",{},null,ownerConsole, null, self.mountInstance);

        // now load the board to pre-populate the self refs
        srcBoard.loadBulk(thread, dummyBuf,"exports",null,false, errFunc);

        // now load again for real and self refs should be resolved
        srcBoard.loadBulk(thread, sourceBuf,"exports",null,false, errFunc);
        let src;
        if (Reflect.has(srcBoard.getCodeArea(), 'exports')) {
            src = srcBoard.getCodeArea().exports;
        } else {
            errFunc("Unable to find 'exports'");
            return;
        }

        let st = util.valueType(src);
        if (st === 'function') {
            // treat as single function load
            errFunc("Function not allowed here");
            return;
        }

        let currSplay;
        let destBoard;

        if (st === 'object' || st === 'array') {
            validate.thread(thread);
            thread.console.debug("Copying " + st + " source [" + objName + "]");

            let currTarget = self.getCodeTarget()[objName];
            if (!currTarget) {
                if (st === 'object')
                    currTarget = self.getCodeTarget()[objName] = {};
                else
                    currTarget = self.getCodeTarget()[objName] = [];
            } else {
                let dt = util.valueType(currTarget);

                if (dt != 'object') {
                    thread.console.debug("Trying to load into non-object; switching to object");
                    currTarget = self.getCodeTarget()[objName] = {};
                }

            }
            //thread.console.debug("About to splay target", currTarget);
            thread.console.debug("About to splay target");
            currSplay = delta.splayObject(currTarget);
            //thread.console.debug("About to delta things over", srcBoard);

            thread.console.debug("About to delta into dest board");
            // this needs to match own board exactly
            destBoard = new UnsafeBoard(thread, "dest", currTarget, self.parent, ownerConsole, self.pathSeg, self.mountInstance);
        } else {
            // existing primitive; must be wrapped in isolated object for diff to work
            thread.console.debug("Board loadObject is actually loading primitive (" + st + ") source at [" + objName + "]");

            let tmp = src;
            srcBoard.getCodeArea().exports = vm.createContext({});
            srcBoard.getCodeTarget()[objName] = tmp;

            let currTarget = vm.createContext({});
            currTarget[objName] = self.getCodeTarget()[objName];
            currSplay = delta.splayObject(currTarget);
            //thread.console.debug("About to delta things over", srcBoard);

            // this needs to match own board exactly
            destBoard = new UnsafeBoard(thread, "dest", self.getCodeTarget(), self.parent, ownerConsole, self.pathSeg, self.mountInstance);

        }

        //thread.console.debug("loadObject: About to splay source", srcBoard.getCodeTarget());
        thread.console.debug("loadObject: About to splay source");
        let newSplay = delta.splayObject(srcBoard.getCodeTarget());
        //thread.console.debug("loadObject: Splayed source", newSplay);
        //thread.console.debug("loadObject currSplay", currSplay);

        //thread.console.debug("Delta done", newSplay);

        // apply diffs
        let filterMask = {
            new:        true,
            deleted:    false,
            changed:    true
        };
        let deltaList = delta.getDeltaSplay(currSplay, newSplay, filterMask);
        delta.attachComputations('exports', deltaList);
        //thread.console.info("board loadObject - deltaList w comps", deltaList);
        //thread.console.info("board loadObject - codearea", self.getCodeArea());
        thread.console.debug("Board is applying computations from delta list");
        delta.applyComputations(deltaList, destBoard.getCodeArea());

        // end object load
    };

    self.delete = function(thread, item) {
        validate.thread(thread);

        try {
            let buf = "delete " + "exports." + item;
            vm.runInContext(buf, self.getCodeArea());
            thread.console.info("Removed [" + item + "]");
        } catch (err) {
            thread.console.warn("Unable to delete [" + item + "]: " + err);
        }

    };

    // param must be an object
    self.overlay = function(thread, obj, filterMask, errFunc) {
        validate.thread(thread);

        if (!filterMask) {
            // default mask does not blow away possibly inwork stuff
            filterMask = {
                new:        true,
                deleted:    false,
                changed:    true,
                forceArray: true    // allow array delete and insert logic
            };
        }

        let splay = delta.splayObject(obj);

        //thread.console.debug("overlay splay", splay)

        // assume merge w root
        let diffs = self.loadBulk(thread, splay, "exports" , filterMask, true, errFunc);
        return diffs;
    };

    self.registerTrigger = function(member, callback) {
        // will clobber any existing
        let t = self.triggers[member];
        if (t) {
            boardThread.console.warn("Clobbered existing board " + self.targetName + " trigger on [" + member + "]");
        }
        self.triggers[member] = callback;
    };

    self.trigger = function(thread, member) {
        //validate.thread(thread);

        // only one per member for sanity sake
        let callback = self.triggers[member];
        if (callback) {
            thread.console.info("Board " + self.targetName + " firing trigger on [" + member + "]");
            callback(self.getCodeTarget()[member]);
        } else {
            //thread.console.debug("Board " + self.targetName + " has no trigger for [" + member + "]");
        }

        // if no match then ignore

    };

    self.getExports = function() {
        return self.getCodeTarget();
    }

    self.cleanPath = function(thread, path) {
        validate.thread(thread);

        let newPath = path.replace(/\'\]\[\'/g,'.');
        return newPath.substring(2, newPath.length-2);
    };

    self.resolvePath = function(methodPath) {
        return self.run(boardThread, methodPath);
    }


    return self;
};

module.exports = { class: UnsafeBoard };

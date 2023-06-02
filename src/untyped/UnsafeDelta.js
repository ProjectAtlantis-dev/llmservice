/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */

let vm = require('vm');

let util = require("./Util").singleton;

let pretty = require("./Pretty").singleton;

let validate = require("../selftyped/Validate").singleton;


// hotloader
let UnsafeDelta = function (thread) {
    let self = this;

    self.outputObject = [];

    // converts bracket delta format back to dots;
    // since bracket format only used internally in delta
    // this is not useful for converting slashes
    self.cleanPath = function(path) {
        //thread.console.debug("cleanpath in: " + path);

        let newPath = path.replace(/\'\]\[\'/g,'.');

        if (newPath.startsWith('[\'')) {
            newPath = newPath.substring(2);
        }

        if (newPath.endsWith('\']')) {
            newPath = newPath.substring(0, newPath.length-2);
        }

        //thread.console.debug("cleanpath out: " + newPath);
        return newPath;
    };

    self.walk = function (o, parentPath, walkCache, walkStack = [], seen = new WeakMap(), seenCnt=0, seg, parent) {

        //let currPath = walkStack.join(".");
        let currPath = walkStack.join("");
        //thread.console.debug("Walking [" + currPath + "]");

        if (!currPath)
            currPath = "";

        let obj = walkCache[currPath] = {};
        obj.path = currPath;
        obj.target = currPath;
        obj.pPath = parentPath;

        let t = util.valueType(o);
        obj.type = t;
        let x, child;

        if (parent && seg) {
            // looking for real properties
            let propDesc = Reflect.getOwnPropertyDescriptor(parent,seg);
            // ony do proxies right now
            if (propDesc && propDesc.get) {
                // is a real prop desc
                obj.isProperty = true;
                obj.isReal = true;
                obj.type = 'object';
                //thread.console.softError("Delta walk found properties for: " + seg);
                obj.propertyDesc = {
                    propName: seg,
                    get: pretty.inspect(propDesc['get']),
                    set: pretty.inspect(propDesc['set']),
                    val: pretty.inspect(propDesc['get']()),
                };

                return obj;
            }
        }

        if (t === "object") {

            try {
                seen.set(o, true);
            } catch (err) {
                thread.console.error(err, o);
            }

            obj.isObject = true;

            if (o.propName && o.isProperty) {
                // pseudo property; needs to be aligned with computations
                obj.isProperty = true;
                obj.isReal = false;
                obj.propertyDesc = {
                    propName: o.propName,
                    get: pretty.inspect(o['get']),
                    set: pretty.inspect(o['set']),
                    val: pretty.inspect(o['val']),
                };
            } else {

                // don't dare try to walk binary data unless you want a meltdown
                if (!(o instanceof Buffer)) {

                    for (x in o) {

                        if (x[0] === '$') {
                            // ignore any attr starting w dollar sign
                            thread.console.warn("Ignored attribute " + currPath + "." + x);
                            continue;
                        }

                        if (seen.has(o[x])) {
                            // we have a possible cycle; this may be deliberate with self referencing
                            // stuff; we don't allow depth to exceed max threshold

                            if (seenCnt < 5) {
                                //thread.console.verbose("Possible cycle: " + currPath + "." + x);
                                seenCnt++;
                            } else {
                                //thread.console.softError("Max cycle depth exceeded: " + currPath + "." + x);
                                continue;
                            }
                        }

                        //thread.console.verbose("Walking object member " + x);
                        walkStack.push("[\'" + x + "\']");
                        child = self.walk(o[x], obj.path, walkCache, walkStack, seen, seenCnt, x, o);
                        child.member = x;

                        walkStack.pop();

                    }
                }
            }
        } else if (t === 'array') {
            obj.isObject = true;
            obj.isArray = true;
            obj.arrayLen = o.length;
            for (x in o) {

                if (seen.has(o[x])) {
                    // we have a cycle
                    //thread.console.verbose("Skipped cycle: " + currPath + "." + x);
                    continue;
                }

                //thread.console.verbose("Walking array item " + x);
                //walkStack.push(x);
                walkStack.push("[\'" + x + "\']");
                child = self.walk(o[x], obj.path, walkCache, walkStack, seen, seenCnt, x, o);
                child.member = x;
                child.inArray = true;
                child.arrayLen = o.length;
                walkStack.pop();
            }
        } else if (t === "function") {
            obj.value = pretty.inspect(o);
            obj.isFunction = true;
            obj.params = util.getArgs(o);
            obj.retlet = util.getReturn(obj.value);
            if (obj.retvar) {
                //thread.console.debug("Found retvar: " + obj.retvar);
            }
            obj.header = o.header;
        } else {
            obj.value = o;
            if (t === "date") {
                obj.isDate = true;
                if (util.valueType(obj.value) != 'date') {
                    throw new Error("Walk date handling caused accidental string conversion");
                }
            } else if (t === "string") {
                if (util.isDate(obj.value)) {
                    obj.isDate = true;
                    obj.value = new Date(obj.value);
                } else {
                    obj.isString = true;
                }

            }
        }

        return obj;
    };

    // splay into hash
    self.splayObject = function (o) {
        //validate.thread(thread);

        //thread.console.debug("DELTA splayObject obj", o);
        let walkCache = {};
        self.walk(o, null, walkCache);
        //thread.console.debug("DELTA splayObject walk", walkCache);
        return walkCache;
    };

    // only return those elements that are in the filter
    self.filterSplay = function (splay, filterSplay) {
        let outSplay = {};
        for (let k of Object.keys(filterSplay)) {
            thread.console.debug("Filtering " + k);

            for (let l of Object.keys(splay)) {
                if (l.startsWith(k + ".")) {
                    thread.console.debug("Adding " + l);
                    outSplay[l] = splay[l];
                }
            }
        }
        return outSplay;
    };

    self.filterObject = function (s, f) {
        let splay = self.splayObject(s);
        let filterSplay = self.splayObject(f);
        let resultSplay = self.filterSplay(splay, filterSplay);

        return resultSplay;
    };

    self.getDeltaSplay = function (startSplay, endSplay, filterMask = null) {
        //validate.thread(thread);

        if (!startSplay)
            startSplay = {};

        if (!endSplay)
            endSplay = {};

        if (!filterMask) {
            filterMask = {
                new:        true,
                deleted:    true,   // do NOT combine w forceArray = true !!
                changed:    true
            };
        }

        if (util.valueType(startSplay) != "object") {
            thread.console.error("start arg is not a splay");
        }

        if (util.valueType(endSplay) != "object") {
            thread.console.error("end arg is not a splay");
        }

        //thread.console.debug("start splay", startSplay);
        //thread.console.debug("end splay", endSplay);

        let startKeys = Object.keys(startSplay);
        let endKeys = Object.keys(endSplay);
        let delta = util.computeArrayDelta(startKeys, endKeys);

        delta.changed = {};
        for (let x in delta.unchanged) {
            let startMeta = startSplay[x];
            let endMeta = endSplay[x];
            if (startMeta.type != endMeta.type) {
                delta.changed[x] = 'type change';
            } else if (startMeta.isProperty != endMeta.isProperty) {
                delta.changed[x] = 'property change';
            } else {
                let smt = startMeta.type[0];
                if (smt === "f" || smt === "s") {
                    // string or function
                    if (startMeta.value.length != endMeta.value.length) {
                        delta.changed[x] = 'len change';
                        //thread.console.debug("Function [" + x + "] change");
                    }
                }

                if (smt === "f") {
                    if (startMeta.header != endMeta.header) {
                        delta.changed[x] = 'fun hdr change';
                        //thread.console.debug("Function [" + x + "] change");
                    }
                }

                if (!delta.changed[x]) {

                    switch (startMeta.type[0]) {
                        case "d":
                            {
                                // date
                                let sdt = util.valueType(startMeta.value);
                                let edt = util.valueType(endMeta.value);
                                if (sdt != edt) {
                                    thread.console.softError("start", startMeta);
                                    thread.console.softError("end", endMeta);
                                    throw new Error("Delta found date unexpectedly converted from " + sdt + " to " + edt + ": " + x);
                                }
                                if (sdt != 'date') {
                                    throw new Error("Delta found strings where dates should be: " + x);
                                }
                                if (startMeta.value.getTime() != endMeta.value.getTime()) {
                                    delta.changed[x] = 'date value change';
                                }
                                break;
                            }
                        case "n":
                            {
                                // number string etc.
                                let sN = isNaN(startMeta.value);
                                let eN = isNaN(endMeta.value);

                                if (sN || eN) {
                                    if (sN !== eN) {
                                        delta.changed[x] = 'value NaN change';
                                    }
                                    break;
                                }
                            }
                            // fall through
                        default:
                            if (startMeta.value != endMeta.value) {
                                delta.changed[x] = 'value change';
                            }
                    }

                }

            }

            if (delta.changed[x]) {
                //thread.console.debug("Delta", delta.changed[x]);
                delete delta.unchanged[x];
            }

        }

        let outDelta = {d: [], a: [], c: [], u: []};
        //thread.console.debug("DELTA getDeltaSplay", filterMask);
        Object.keys(delta.deleted).map(function (x) {
            let splay = startSplay[x];
            splay.delta = "d";
            //thread.console.debug("Delta delete", splay);
            //thread.console.debug("Delta delete", filterMask);

            // WARNING: do NOT combine delete with forceArray delete!!! or it will cancel out
            // array changes can imply delete logic so forceArray 'delete' logic says plz happen even if
            // overall deletes are disabled

            if (filterMask.source) {
                // this is a little bit of a hack to apply internal deletes but still preserve external
                // stuff; this usually happens when renaming keys inside JSON objects

                let cp = self.cleanPath(splay.pPath);  // might be better to convert filtermask to bracket format instead

                //thread.console.debug("Checking source " + cp);
                // source specified; we always apply internal deletes in the source since this is assumed master
                if (cp.startsWith(filterMask.source)) {
                    //thread.console.info("Applying source delete", splay);
                    outDelta.d.push(splay);
                }

            } else {

                if (!filterMask.forceArray && (filterMask.deleted || splay.inArray || (splay.type === 'array'))) {
                    outDelta.d.push(splay);
                }
            }
        });

        // sort delete deep -> shallow
        outDelta.d.sort(function (b, a) {
            if (a.path > b.path) return 1;
            if (a.path < b.path) return -1;
            return 0;
        });


        Object.keys(delta.new).map(function (x) {
            let splay = endSplay[x];
            splay.delta = "a";
            if (filterMask.new || splay.inArray) {
                outDelta.a.push(splay);
            }
        });

        // sort adds shallow -> deep
        outDelta.a.sort(function (a, b) {
            if (a.path > b.path) return 1;
            if (a.path < b.path) return -1;
            return 0;
        });


        Object.keys(delta.changed).map(function (x) {
            let splay = endSplay[x];
            splay.delta = "c";
            splay.priorValue = startSplay[x].value;
            if (filterMask.changed || splay.inArray) {
                outDelta.c.push(splay);
            }
        });

        Object.keys(delta.unchanged).map(function (x) {
            let splay = endSplay[x];
            splay.delta = "u";
            outDelta.u.push(splay);
        });

        let arr = [].concat(outDelta.d, outDelta.c, outDelta.a, outDelta.u);

        let pMap = {};
        arr.map(function(item) {
            pMap[item.path] = item;
        });

        arr.map(function (item) {
            if (item.pPath) {
                let parentItem = pMap[item.pPath];
                if (!parentItem) {
                    // trying to get clever w array updates can lead to this
                    thread.console.softError("Invalid parent: " + item.pPath + " (may want to mask)");
                } else {
                    item.pTarget = parentItem.target;
                }

            }
        });

        let deltaList = arr.filter(function (item) {
            return item.delta != "u";
        });

        //thread.console.debug("getDeltaSplay", deltaList);

        return deltaList;
    };

    // targetRoot is path (text) from root to target
    self.attachComputation = function (targetRoot, delta) {
        //validate.thread(thread);

        let contextPrefix = "";

        let currTarget = targetRoot + delta.target;

        let argsStr = contextPrefix + "_args";

        let actions = {};

        if (delta.pPath === '')
            actions["at_root"] = true;

        if (delta.delta === "d") {

            if (delta.isProperty || delta.propertyOf) {
                // delete property?

                // delete propertyOf doesn't really make sense
            } else {

                if (delta.inArray) {
                    delta.comp = targetRoot + delta.pTarget + ".splice(" + delta.member + ",1)";
                    actions["array_item_del"] = true;
                } else {
                    delta.comp = currTarget + "=undefined;delete " + currTarget;
                    actions["obj_item_del"] = true;
                }

                if (delta.isObject) {
                    if (delta.isArray) {
                        actions["array_delete"] = true;
                    } else {
                        actions["obj_delete"] = true;
                    }
                } else {
                    // do nothing
                }
            }
        } else {

            if (delta.isProperty || delta.propertyOf) {
                // upsert property (val)

                if (delta.isProperty) {

                    delta.comp = `
                        Object.defineProperty(exports${delta.pPath||''}, '${delta.propertyDesc.propName}', {
                            enumerable: true,
                            configurable: true,
                            get: ${delta.propertyDesc.get},
                            set: ${delta.propertyDesc.set},
                            val: ${delta.propertyDesc.val}
                        });
                    `

                } else {

                    // do nothing? or upsert propertyOf get() and set()

                }

                // must set configurable to true or else cannot update later
                // must set enumerable to true or else cannot see it
                // writable probably better handled with permissions

            } else {

                if (delta.inArray) {
                    actions["array_item_ups"] = true;
                    if (delta.delta === "a")
                        actions["array_item_add"] = true;
                } else {
                    actions["obj_item_ups"] = true;
                    if (delta.delta === "a")
                        actions["obj_item_add"] = true;
                }

                if (delta.isObject) {
                    if (delta.isArray) {
                        delta.comp = currTarget + "=[]";
                        actions["array_create"] = true;
                    } else {
                        delta.comp = currTarget + "={}";
                        actions["obj_create"] = true;
                    }
                } else {

                    if (delta.isDate) {
                        delta.comp = currTarget + "=new Date(" + argsStr + "['dat']);\n";
                        delta.comp += "if (!(" + currTarget + " instanceof Date)) throw 'bad delta date load';\n";

                        delta.args = {};
                        delta.args["dat"] = delta.value;
                    } else if (delta.isFunction) {
                        // check to make sure object to string convertion did not lose func body
                        // this is a common problem w JSON converters

                        delta.comp = "";
                        delta.comp += currTarget + "=eval('(' + " + argsStr + "['func'] + ')');\n";

                        // reattach
                        delta.comp += currTarget + ".params=" + argsStr + "['params'];\n";
                        delta.comp += currTarget + ".retvar=" + argsStr + "['retvar'];\n";
                        delta.comp += currTarget + ".header=" + argsStr + "['header'];\n";

                        delta.args = {};

                        //delta.args["func"] = "_fx=" + delta.value;  // DO NOT EVAL HERE; wrong context
                        delta.args["func"] = delta.value;  // DO NOT EVAL HERE; wrong context
                        delta.args["params"] = delta.params;
                        delta.args["retvar"] = delta.retvar;
                        delta.args["header"] = delta.header;

                    } else if (delta.isString) {
                        delta.comp = currTarget + "=" + argsStr + "['str']";
                        delta.args = {};
                        delta.args["str"] = delta.value;
                    } else {
                        delta.comp = currTarget + "=" + delta.value;
                    }

                    if (delta.inArray) {
                        // force update of array length since JS is a little flaky about this
                        delta.comp += ";\n";
                        delta.comp += targetRoot + delta.pPath + ".length=" + delta.arrayLen + ";\n";
                    }
                }
            }
        }

        // merge
        delta.actions = actions;

    };

    self.attachComputations = function (targetRoot, deltaList) {
        deltaList.map(function (delta) {
            self.attachComputation(targetRoot, delta);
        });

        // uncomment these for debugging
        if (deltaList.length) {
            //thread.console.debug("delta attach computations", deltaList);
        } else {
            //thread.console.warn("delta attach computations is empty");
        }
    };

    // see board to create a context
    self.applyComputations = function (compList, context, useCurrent=false) {
        //validate.thread(thread);

        let contextPrefix = "";

        let i = 0;
        let compArgs = [];
        let buf = "\n";
        buf += contextPrefix + "_args = null;\n";
        //buf += contextPrefix + "_argMap = {};\n";
        compList.map(function (comp) {
            if (comp.args) {
                buf += contextPrefix + "_args = " + contextPrefix + "_argMap[" + i + "];\n";
                compArgs[i] = comp.args;

                i++;
            }
            buf += comp.comp + ";\n";
        });
        buf += "delete " + contextPrefix + "_args;\n";
        buf += "delete " + contextPrefix + "_argMap;\n";

        // INJECT ARGS
        context._args = null;
        context._argMap = compArgs;  // this is the reason contextPrefix is so troublesome
        //context._loopback = context;  // needed for browser apply

        //thread.console.debug("applyComputations", context);

        try {
            if (useCurrent) {
                //thread.console.debug("Running in current context");
                vm.runInThisContext(buf);
            } else {
                //thread.console.debug("Running in specified context");
                vm.runInContext(buf, context);
            }
        } catch (err) {
            //thread.console.debug(util.lineify(util.replace("_attic","XXX",buf)));
            thread.console.softError("Apply computations failed");
            thread.console.debug(util.lineify(buf));
            let errorLine = util.getErrorLine(err);
            if (errorLine)
                thread.console.softError("See line " + errorLine);
            thread.console.softError(err);
            throw err;
        }

        // clear clutter
        delete context._args;
        delete context._argMap;
        //delete context._loopback;

    };



};

// no singleton because I need thread

module.exports = { class: UnsafeDelta };

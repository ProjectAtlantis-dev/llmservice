/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-var-requires */

console.log("******************");
console.log("*                *");
console.log("*  TYPE BUILDER  *");
console.log("*                *");
console.log("******************");

let pth = require('path');
let fs = require('fs');
let chokidar = require('chokidar');
let stringExtractor = require('extract-string');
let stripComments = require('strip-json-comments');
const mkdirp = require('mkdirp');

let TypeBuilder = function() {
    let self = this;

    self.replace = function(oldStr, newStr, buf) {
        if (!buf || buf.length === 0) {
            return '';
        }

        let re = new RegExp(oldStr, "g");
        let outStr = buf.replace(re, newStr);
        return outStr;
    };

    // NOTE this will blow up on function params with comments next to them that contain
    // parenthesis

    self.extractSelfTypes = function(buf, regex, types, offset=5) {

        // extract all dot function stuff

        // extract all dot stuff
        //let regex = /self(\.[A-Za-z\_]+)+/g;
        let result = buf.match(regex);

        if (!result) {
            // also happens if file has no self references
            //console.warn("No types found for " + regex);
            return;
        }

        //console.log(result);

        let norm = {};
        result.map(function(item) {
            //console.log("found " + item);
            let key = item.substring(offset); // remove self
            // need to support variadic args
            key = self.replace('[.][.][.]','_elip_', key);
            //thread.console.info(key);

            let subtypes = key.split(".");
            norm[subtypes[0]] = true;
            //thread.console.info(key);
        });

        //console.log(norm);

        Object.keys(norm).map(function(item) {
            //thread.console.info('-->' + item);
            item = self.replace('_elip_','...', item);

            if (Reflect.has(types, item)) {
                console.error("ERROR: Multiple definitions found for [" + item + "]");
            } else {
                types[item] = norm[item];
            }

        });
    };

    self.bufferToLines = function(buf) {
        if (buf && buf.replace)
            return buf.replace(/\r\n/, "\n").split("\n");
        else
            return [];
    };

    self.processBuffer = function(buf, typeName, basePath, outRoot) {

        let types = {};
        let regex;

        // grab functions first
        let classRefs = {};

        regex = /self(\.[A-Z0-9a-z\_]+)+(\s*)[=](\s*)(function|async(\s*)function)([\s\S]*?)[\)]([\s\S]*?)[\{]/g;
        self.extractSelfTypes(buf, regex, types);

        //console.log(types);

        let outTypes = {};
        Object.keys(types).map(function(ti) {

            let offset = ti.indexOf("=");
            let memberName = ti.substring(0,offset).trim();
            let decl = ti.substring(offset);

            //thread.console.debug("outtypes foo", decl);

            if(ti.indexOf(":") >= 0) {
                //thread.console.info("typebuilder parsing " + ti);
                //let args = decl.substring(decl.indexOf("function") + 8);
                let argsSection = decl.substring(decl.indexOf("("));


                // look for return type
                let endOffset = argsSection.lastIndexOf(")");
                let retSection = argsSection.substring(endOffset);

                let retType = "any";
                let retOffset = retSection.indexOf(":");
                if (retOffset >=0) {
                    let retEndOffset = retSection.lastIndexOf("{");
                    retType = retSection.substring(retOffset+1, retEndOffset - retOffset).trim();
                    if ((retType.endsWith("T")||retType.endsWith("DBT")) && !Reflect.has(classRefs, retType)) {
                        // assume external class reference
                        classRefs[retType] = true;
                    } else if (retType.startsWith("Promise<")) {
                        // dealing w a Promise decl - this is a hack mess
                        console.log("GOT PROMISE: " + retType);
                        //retType = retType.trim();
                        let innerRetType = retType.substring(8,retType.length-1);

                        if (innerRetType.startsWith("Array<")) {
                            innerRetType = innerRetType.substring(6,innerRetType.length-1);
                        }

                        if (innerRetType != 'any') {
                            classRefs[innerRetType] = true;
                        }
                        console.log("Extracted promise type: " + innerRetType);
                    }

                }

                let args = argsSection.substring(1,endOffset);
                args = args.trim();
                //console.log("args: " + args);
                // remove param initializers
                let newArgs = [];
                args.split(",").map(function(arg) {
                    //console.log("arg: " + arg);
                    let ei = arg.indexOf("=");
                    if (ei >=0) {
                        // contains default initializer; make optional?
                        arg = arg.substring(0, ei);
                        let faOffset = arg.indexOf(":");
                        if (faOffset >=0) {
                            let first = arg.substring(0,faOffset);
                            let last = arg.substring(faOffset+1, arg.length);
                            arg = first + "?:" + last;
                        }
                    }
                    newArgs.push(arg);
                });
                args = "(" + newArgs.join(",") + ")";
                //console.log("ret section: " + retSection);
                //console.log("ret type: " + retType);

                ti = memberName + args.trim() + ":" + retType + ";";

                console.log("==> " + ti);

                let paramList = args.substring(1, args.length-1);

                let params = paramList.split(",");
                //thread.console.info("params: ", params);
                params.map(function(p) {
                    let tok = p.split(":");
                    if (tok.length > 1) {
                        let className = tok[1].trim();

                        if (className.startsWith("?")) {
                            className = className.substring(1);
                        }

                        if (className.startsWith("Array<")) {
                            className = className.substring(6,className.length-1);
                        }

                        //thread.console.info("class: " + className);
                        if ((className.endsWith("T")||className.endsWith("DBX")) && !Reflect.has(classRefs, className)) {

                            // assume external class reference
                            classRefs[className] = true;
                        }


                    }
                });

            } else {
                ti = memberName + ":Function;";
            }

            // now build final buffer
            if (memberName.length > 0) {
                outTypes[memberName] = ti;//memberName + ":Function;\n" + ti;
            } else {
                //thread.console.softError("Skipped " + ti);
            }
        });

        //thread.console.info("typebuilder regex functions", outTypes);


        types = {}; // reset types
        regex = /self(\.[A-Za-z\_]+)(\s*)\(+/g;
        self.extractSelfTypes(buf, regex, types);
        let danglingSelfCalls = {};
        Object.keys(types).map(function(memberName) {
            memberName=memberName.replace(" ","");
            let callFunc = memberName.substring(0, memberName.length-1);
            if (!outTypes[callFunc]) {
                danglingSelfCalls[callFunc] = true;

            }
        });

        //thread.console.info("typebuilder self calls", danglingSelfCalls);

        types = {}; // reset types
        regex = /self(\.[A-Za-z\_]+)(\s*)\=(?!\=)+/g;
        self.extractSelfTypes(buf, regex, types);
        let assigns = {};
        Object.keys(types).map(function(memberName) {

            memberName=memberName.replace(" ","");
            let assign = memberName.substring(0, memberName.length-1);
            if (!outTypes[assign]) {
                assigns[assign] = assign + ": any;";
            }
        });

        //thread.console.info("typebuilder assigns", assigns);

        types = {};
        regex = /self(\.[A-Za-z\_]T+)+/g;
        self.extractSelfTypes(buf, regex, types);
        Object.keys(types).map(function(memberName) {
            if (outTypes[memberName]) {
                // already found as a function
                //thread.console.softError("Conflict found for member [" + memberName + "]");
            } else {
                if (danglingSelfCalls[memberName]) {
                    console.warn("Dangling reference to self function: " + memberName);
                } else if (!danglingSelfCalls[memberName]) {
                    // unknown member
                    outTypes[memberName] =  memberName + ": any;";
                } else if (!assigns[memberName]){
                    // need to ignore the db autogen methods
                    if (memberName != "get" && !typeName.endsWith("MgrT"))
                        console.warn("Possible reference to missing self function: " + memberName);
                }
            }
        });

        outTypes = Object.assign(assigns, outTypes);

        //thread.console.info("typebuilder out types", outTypes);

        types = {};
        regex = /type (\s*)([A-Za-z\_]+)T(\s*)=/g;
        self.extractSelfTypes(buf, regex, types);
        let classDecls = {};
        Object.keys(types).map(function(memberName) {
            memberName=memberName.replace(" ","");
            let typeName = memberName.substring(0, memberName.length-1);
            //thread.console.warn("Found type decl for " + typeName);
            classDecls[typeName] = true;
        });
        //thread.console.info("typebuilder class decls", classDecls);


        //console.log("===> CURR DIR: " + __dirname);
        //console.log("===> BASE PATH: " + basePath);

        //let targetPath = __dirname + "/src/types";
        //console.log("===> TARGET PATH: " + targetPath);

        //let commonPath = __dirname + "/src/common";
        //console.log("===> COMMON PATH: " + commonPath);

        //let relPath = pth.relative(targetPath, commonPath);
        //console.log("===> REL PATH: " + relPath);

        // now pull in all imports
        let importBuf = "";
        let classImports = {};
        let lines = self.bufferToLines(buf);
        lines.map(function(line) {
            let recArr = stringExtractor(line).pattern('import{typeName}from{path}');
            if (recArr.length>0) {
                let rec = recArr[0];

                if (!rec.typeName) {
                    console.error("ERROR: Failed to get import type name: " + line);
                    return;
                }

                rec.typeName = rec.typeName.trim();
                rec.path = rec.path.trim();
                //console.log(rec);

                let typeRec = stringExtractor(rec.typeName).pattern("\{{typeName}\}")[0];
                //console.log(typeRec);

                if (!typeRec) {
                    console.error("ERROR: Failed to extract type record: " + line);
                    return;
                }

                if (!typeRec.typeName) {
                    console.error("ERROR: Failed to find type name: " + line);
                    return;
                }

                let typeName = typeRec.typeName.trim();


                let pathRec = stringExtractor(rec.path).pattern("\"{path}\"")[0];
                if (!pathRec) {
                    // may happen with newer import declarations
                    console.error("ERROR: Unable to extract path declaration; check source file");
                    return;
                }
                //console.log(pathRec);
                let pathName = pathRec.path.trim();

                if (pathName.indexOf("/common/") >= 0 || pathName.indexOf("/dbtypes/") >= 0) {

                    console.log(typeName + " " + pathName);

                    classImports[typeName] = true;

                    // yeah the path stuff is a little hacky
                    //console.log("===> FINAL PATH: " + pathName);
                    //pathName = "./src/" + pathName;

                    let foo = "import type {" + typeName + "} from \"" + pathName + "\"\n";
                    //console.log("COMMON ===> " + foo);
                    importBuf += foo;
                }
            }
        });


        // dangling stuff
        let extraImportBuf = "";
        Object.keys(classRefs).map(function(cr) {
            if (cr.endsWith("T")) {
                // if not declared locally then import
                if (!classImports[cr]) {
                    //console.log("===> COMMON PATH NAME: " + cr);
                    //let relPath = pth.relative(cr, outRoot)
                    //console.log("===> COMMON REL PATH: " + relPath);

                    let foo = `import {${cr}} from "./${cr}";\n`;

                    //console.log("===> " + foo);

                    extraImportBuf += foo;
                } else {
                    extraImportBuf += `// ${cr} declared locally \n`;
                }
            }
        });

        //thread.console.info("typebuilder regex", outTypes);
        // BUILD THE OUTPUT BUFFER
        let typeBuf = `

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */

// AUTOGENERATED from TypeBuilder on ${new Date()}

// NOTE: If TSC cannot find a name, it is probably because the
// TypeBuilder missed a dangling import during parsing


// path
// ${basePath}

// copied imports
${importBuf}

// dangling imports
${extraImportBuf}

// unresolved
//${Object.keys(classDecls)}


export type ${typeName} = {\n
`;

        let itemArr = [];
        Object.keys(outTypes).map(function(typ) {
            itemArr.push(outTypes[typ]);
        });
        typeBuf += "    " + itemArr.join("\n    ");

        typeBuf += `

};\n`;

        return typeBuf;


    }; // end processBuffer




    self.watch = function(filePath, callback) {

        let watcher = chokidar.watch([], {
            cwd: filePath,
            /*
            usePolling: true,
            interval: 1000,
            */
            depth:0
        });
        watcher.on("all", function (event, rawPath) {

            // convert any backslashes to forward
            let fullPath = rawPath.replace("\\", "/");

            // add, addDir, change, unlink, unlinkDir
            callback(fullPath, event);

        });
        watcher.add(filePath);
        return watcher;
    };

    self.loadFileSync = function (resPath) {
        let fullPath = pth.resolve(resPath);

        //thread.console.debug("Loading [" + fullPath + "]");

        let data = fs.readFileSync(fullPath, 'utf-8');
        return data;
    };

    self.saveFileSync = function (buf, path) {
        console.log("SAVING file " + path);

        fs.writeFileSync(path, buf, 'utf-8');
    };

    self.getExt = function(thePath) {
        return pth.extname(thePath);
    };

    self.getBaseName = function(thePath) {

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

    self.debounce = function(func, wait=150, immediate) {
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
    };

    self.terminate = true;

    self.idle = self.debounce(function() {
        console.log("Waiting");

        if (self.terminate) {
            console.log("Terminating (use -w for watch mode)");
            process.exit();
        }
    }, 2000);

    self.scanFiles = function(relPath) {
        // build type system

        console.log("Scanning " + relPath);

        let watcher = self.watch(process.cwd() + relPath,
            // process type for each .js file
            function(fullPath, event) {

                if (fullPath.length === 0 ||
                    fullPath.startsWith(".")) {
                    return;
                }

                console.log(event + ": " + fullPath);

                // ignore anything called OLD
                if (fullPath.endsWith("OLD.js"))
                    return;

                let extName = self.getExt(fullPath);

                if (extName != ".ts" && extName != ".js") {
                    //console.log("IGNORED " + fullPath);
                    return;
                }
                //console.log("PROCESSING " + fullPath + " [" + event + "]");

                let actualPath = process.cwd() + relPath + "/" + fullPath;
                let typeName = self.getBaseName(fullPath) + "T";

                switch(event) {
                    case 'add':
                    case 'change':
                        {

                        console.log("===> REL PATH: " + relPath);
                        let outRoot = process.cwd() + "/src/types/";

                        // some hacky shit here because selftyped/web and selftyped/dsl at different level of indenture
                        // than /types
                        if (relPath === "/src/selftyped/web") {
                            outRoot += "web/";
                        }
                        if (relPath === "/src/selftyped/dsl") {
                            outRoot += "dsl/";
                        }

                        mkdirp.sync(outRoot);
                        let outPath = outRoot + typeName + ".ts";

                        console.log("===> PROCESSING [" + actualPath + "] to [" + outPath + "]");

                        let buf = self.loadFileSync(actualPath);

                        // strip comments may do bad things to the untyped stuff
                        if (actualPath.indexOf("/src/untyped")<0) {
                            buf = stripComments(buf);
                        }

                        let outBuf = self.processBuffer(buf, typeName, relPath, outRoot);

                        self.saveFileSync(outBuf, outPath);

                        /*
                        exec("/bin/cat src/flow/*.js > src/flow/AllTypes.ts", function(err, stdout, stderr) {
                            if (err) {
                                console.log(err);
                                return;
                            }

                            if (stderr) {
                                console.log(stderr);
                            }

                        });
                        */

                        self.idle();

                        break;
                        }
                    case 'unlink':
                    case 'unlinkDir':
                        break;
                    default:
                        break;
                }
            }
        );
    };

    self.run = function() {
        console.log("Starting");

        let args = process.argv;
        let runForever = args[2];
        if (runForever) {
            if (runForever === "-w") {
                self.terminate = false;
                console.log("Running in watch mode");
            } else {
                console.error("ERROR: Unknown parameter: " + runForever);
                return;
            }
        } else {
            console.log("Running in single pass mode");
        }



        self.scanFiles("/src/untyped");  // untyped still gets a basic template
        //self.scanFiles("/src/common");  // already types; don't overcook
        self.scanFiles("/src/selftyped");
        self.scanFiles("/src/browser");

        console.log("Done");  // we normally don't get here because we go to idle()

        self.idle();
    };


    return self;

};

try {
    let tb = new TypeBuilder();
    tb.run();
} catch (err) {
    console.error(err);
}


module.exports = { class: TypeBuilder };

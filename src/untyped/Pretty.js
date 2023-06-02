/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */



let util = require("./Util").singleton;

let Pretty = function() {
    let self = this;


    self.TOSTRING = Object.prototype.toString;

    self.valueType = function (o) {
        return util.valueType(o);
    };

    // util.inspect and others are problematic in the way they handle function body

    // below is modified from https://github.com/cvadillo/js-object-pretty-print
    self.inspect = function (
        jsObject,
        indentLength = 4,
        outputTo = "print",
        fullFunction = true,
        newLine = "\n",
        ignoreProxy = false,
        doIsoDate = false
        ) {

        let indentString,
            newLineJoin,
            repeatString,
            prettyObject,
            prettyObjectJSON,
            prettyObjectPrint,
            prettyArray,
            functionSignature,
            pretty,
            visited;


        repeatString = function (src, length) {
            let dst = '',
                index;
            for (index = 0; index < length; index += 1) {
                dst += src;
            }

            return dst;
        };

        prettyObjectJSON = function (object, indent) {
            let value = [],
                property;

            indent += indentString;
            for (property in object) {
                if (Reflect.has(object, property)) {
                    value.push(indent + '"' + property + '": ' + pretty(object[property], indent));
                }
            }

            return value.join(newLineJoin) + newLine;
        };

        prettyObjectPrint = function (object, indent) {
            let value = [],
                property;

            indent += indentString;
            for (property in object) {

                // check for proxy
                let proxy = Reflect.getOwnPropertyDescriptor(object,property);
                if (proxy && proxy.get && !ignoreProxy) {
                    let obj = {};
                    obj.val = object[property];
                    obj.get = proxy.get;
                    obj.set = proxy.set;
                    value.push(indent + "_prop_" + property + ': /* proxy */ ' + pretty(obj, indent));
                } else {
                    let buf = property;

                    if (Reflect.has(object, property)) {

                        if (property === "") {
                            buf = '""';
                        } else {
                            buf = '"' + property + '"';
                        }
                        /*
                        } else if (property[0] === '[') {
                            buf = '"' + property + '"';
                        } else if (property.indexOf(".") >= 0 || property.indexOf("/") >=0 || property.indexOf(" ") >=0) {
                            buf = '"' + property + '"';
                        }
                        */
                        value.push(indent + buf + ': ' + pretty(object[property], indent));
                    }
                }

            }

            let outBuf = value.join(newLineJoin) + newLine;
            //console.log("pretty object print: " + outBuf);
            return outBuf;
        };

        prettyArray = function (array, indent) {
            let index,
                length = array.length,
                value = [];

            indent += indentString;
            for (index = 0; index < length; index += 1) {
                value.push(pretty(array[index], indent, indent));
            }

            return value.join(newLineJoin) + newLine;
        };

        functionSignature = function (element) {
            let signatureExpression,
                signature;

            // this needs to be updated for node 10

            element = element.toString();
            signatureExpression = new RegExp('function\\s*.*\\s*\\(.*\\)');
            signature = signatureExpression.exec(element);
            signature = signature ? signature[0] : '[object Function]';
            return fullFunction ? element : '"' + signature + '"';
        };

        pretty = function (element, indent, fromArray, allowCircularCnt=5) {
            let type;

            if (element && element.nodeType) {
                // we actually have an HTML DOM element not a JSO
                return element.outerHTML;
            }

            type = self.valueType(element);
            fromArray = fromArray || '';

            let visitCnt = 1;
            if (visited.has(element)) {

                visitCnt = visited.get(element);
                visitCnt++;

                if (visitCnt > allowCircularCnt) {
                    // we've seen this one before too many times
                    return fromArray + 'circular reference to ' + element.toString();

                }

            }

            switch (type) {
                case 'array':
                    visited.set(element, visitCnt);
                    return fromArray + '[' + newLine + prettyArray(element, indent) + indent + ']';
                case 'boolean':
                    return fromArray + (element ? 'true' : 'false');

                case 'date':
                    if (doIsoDate) {
                        return fromArray + '"' + element.toISOString() + '"';
                    } else {
                        return fromArray + 'new Date("' + element.toString() + '")';
                    }

                case 'number':
                    return fromArray + element;

                case 'object':
                    visited.set(element, visitCnt);
                    return fromArray + newLine + indent + '{' + newLine + prettyObject(element, indent) + indent + '}';

                case 'string':
                    return fromArray + JSON.stringify(element);

                case 'function':
                    return fromArray + functionSignature(element);

                case 'undefined':
                    return fromArray + 'undefined';

                case 'null':
                    return fromArray + 'null';

                default:
                    if (element.toString) {
                        return fromArray + '"' + element.toString() + '"';
                    }
                    return fromArray + '<<<ERROR>>> Cannot get the string value of the element';
            }
        };

        if (indentLength === undefined) {
            indentLength = 4;
        }

        outputTo = (outputTo || 'print').toLowerCase();
        indentString = repeatString(outputTo === 'html' ? '&nbsp;' : ' ', indentLength);
        prettyObject = outputTo === 'print' ? prettyObjectPrint : prettyObjectJSON;
        newLine = outputTo === 'html' ? '<br/>' : newLine;
        newLineJoin = ',' + newLine;
        visited = new WeakMap();
        return pretty(jsObject, '') + newLine;
    };

    self.inspectISO = function (jsObject) {
        let indentLength = 4;
        let outputTo = "print";
        let fullFunction = true;
        let newLine = "\n";
        let ignoreProxy = false;

        return self.inspect(jsObject,indentLength, outputTo,fullFunction,newLine,ignoreProxy,true)
    }


    self.objectToBuffer = function(obj, header = "", target="exports") {
        // make it legal JS not JSON
        let buf = header;
        buf += target + " = " + self.inspect(obj) + "\n";
        return buf;
    };


};

let pretty = new Pretty();

module.exports = { singleton: pretty };

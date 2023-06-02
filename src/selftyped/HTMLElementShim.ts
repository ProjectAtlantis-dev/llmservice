

import {ThreadT} from "../types/ThreadT";
let threadManager = require("../selftyped/Thread").manager;

import {UtilT} from "../types/UtilT";
let util:UtilT = require("../untyped/Util").singleton;


import {HTMLElementShimT} from "../types/HTMLElementShimT";


let HTMLElementShim = function (thread:ThreadT, tagName:string):HTMLElementShimT {
    let self:HTMLElementShimT = this;

    let children:Array<HTMLElementShimT> = [];
    self.appendChild = function(child) {
        children.push(child);
    };

    self.style = {};

    let classes:Array<string> = [];
    self.classList = {
        add: function(str) {
            classes.push(str);
        }
    }

    self.innerHTML = "";

    let wrapString = function(val) {
        if (util.valueType(val) === "string") {
            if (!val.length) {
                val = '\"' + val + '\"';
            }

        }
        return val;

    }

    let initToDash = function(str) {
        let buf = "";
        let i  = 0;
        while (i < str.length) {
            let c = str[i];
            if (c === c.toUpperCase()) {
                // convert to dash and lower
                buf += "-" + c.toLowerCase();
            } else {
                buf += c;
            }
            i++;
        }
        return buf;
    }

    // if you add stuff here be sure to add to keys array below
    self.id = null;
    self.href = "";  // a
    self.target = ""; // a
    self.src = "";  // image
    self.alt = "";
    self.height = "";
    self.width = "";
    self.title = ""; // tooltip
    self.onClick = null;

    self.attributes = {};
    self.setAttribute = function(attrName, attrValue) {
        self.attributes[attrName] = attrValue;
    }

    self.outerHTML = function() {
        let buf = "<" + tagName + " ";

        let keys = ["id", "href", "target", "src", "alt", "height","width","title"];
        keys.map(function(k) {
            if (self[k]) {
                let dashName = initToDash(k);
                buf += dashName + "=\"" + self[k] + "\" ";
            }
        });
        Object.keys(self.attributes).map(function(a) {
            if (self.attributes[a]) {
                buf += a + "=\"" + self.attributes[a] + "\" ";
            }
        });

        if (classes.length) {
            buf += " class=\"" + classes.join(" ") + "\" ";
        }

        let styleKeys = Object.keys(self.style);
        if (styleKeys.length) {
            buf += "style=\"";
            styleKeys.map(function(k) {
                let dashName = initToDash(k);
                buf += dashName + ":" + self.style[k] + "; ";
            });
            buf += "\"";
        }

        if (self.onClick) {
            buf += "onclick=\"" + self.onClick + "\" ";
        }

        buf += ">"; // do not add newlines here or you will mess up pre stuff
        buf += self.innerHTML;

        children.map(function(c) {
            let childBuf = c.outerHTML();
            buf += childBuf + "";
        });


        buf += "</" + tagName + ">";

        return buf;
    }

    return self;
}


module.exports = { class: HTMLElementShim };


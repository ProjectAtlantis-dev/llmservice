



import {ThreadT} from "../types/ThreadT";
let threadManager = require("../selftyped/Thread").manager;

import {HTMLElementShimT} from "../types/HTMLElementShimT";
let HTMLElementShim = require("../selftyped/HTMLElementShim").class;

import {DocumentShimT} from "../types/DocumentShimT";



let DocumentShim = function (thread:ThreadT):DocumentShimT {
    let self:DocumentShimT = this;

    self.createElement = function(name):HTMLElementShimT {
        let element:HTMLElementShimT = new HTMLElementShim(thread,name);
        return element;
    }

    return self;
}


module.exports = { class: DocumentShim };


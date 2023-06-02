/* eslint-disable no-throw-literal */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable prefer-const */


let colors = require('colors');

import {ColorFormatT} from "../types/ColorFormatT";



let ColorFormat = function():ColorFormatT {
    // @ts-ignore
    let self:ColorFormatT = this;

    self.colorFuncs = {};

    // spec is 'dim.blue' etc
    self.makeColorFunc = function(colorSpec:string) {
        let tokens = colorSpec.split(".");

        // build a chain func
        let colorFunc = function(str:string) {

            tokens.map(function(f) {
                let cf = colors[f];
                if (!cf) {
                    // pass thru colors the terminal cannot handle
                    //console.log("MakeColor - not a valid terminal color: " + colorSpec);
                } else {
                    str = cf(str);
                }
            });

            return str;
        };
        return colorFunc;
    };

    self.getColorFunc = function(name:string) {
        if(!name) {
            throw new Error("getColorFunc passed null name");
        }

        let colorFunc = self.colorFuncs[name];
        if (!colorFunc) {
            colorFunc = self.colorFuncs[name] = self.makeColorFunc(name);
        }
        return colorFunc;
    };

    self.colorFormat = function(msg, colorSpec) {
        let colorFunc = self.getColorFunc(colorSpec);
        return colorFunc(msg);
    };

    return self;
};


module.exports = { class: ColorFormat };

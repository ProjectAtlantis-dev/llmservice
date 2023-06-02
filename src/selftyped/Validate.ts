/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prefer-const */

// uses internal console for backup since this is not for public consumption

import {ThreadT} from "../types/ThreadT";
import {ValidateT} from "../types/ValidateT";



// this doesn't do much anymore except show the file and line number for logging/debugging purposes
let Validate = function():ValidateT {
    // @ts-ignore
    let self:ValidateT = this;

    self.thread = function(thread:ThreadT) {

        if (!thread) {
            console.log("Validation failed: invalid thread passed");
        }

        let stack = new Error().stack;
        let stackLine = stack? stack.split("\n")[2] : "";
        stackLine = stackLine.substring(7);

        if (!thread || !thread.console || !thread.isThread) {
            throw new Error("Invalid or missing thread arg provided; check params in call to " + stackLine + "\n" + stack);
        } else {
            thread.console.debug("Entering: " + stackLine);
        }

    };


    return self;
};

// @ts-ignore
let validate:ValidateT = new Validate();

module.exports = { singleton: validate };

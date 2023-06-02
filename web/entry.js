
//console.log("Loading webpack entries");

// these are how global vars are exposed to the browsesr

util = require("../lib/untyped/Util").singleton;

if (!util) {
    console.error("Failed to load util");
}

threadManager = require("../lib/selftyped/Thread").manager;
Thread = require("../lib/selftyped/Thread").class;

// most of the browser-side code lives here as Typescript
Main = require("../lib/browser/Main").class;


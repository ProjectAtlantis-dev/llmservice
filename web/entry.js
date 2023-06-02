console.log("Loading webpack entries");

// these are how global vars are exposed to the browsesr

util = require("../lib/untyped/Util").singleton;

if (!util) {
    console.error("Failed to load util");
}

threadManager = require("../lib/selftyped/Thread").manager;
Thread = require("../lib/selftyped/Thread").class;

// this is the user level websocket client with correlated blocking request/reply
//SockClient = require("../lib/selftyped/SockClient").class;

// most of the browser-side code lives here but at least in Typescript
Main = require("../lib/browser/Main").class;

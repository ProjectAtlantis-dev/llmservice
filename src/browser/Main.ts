
let moment = require('moment');
let PromiseB = require('bluebird');


let util = require("../untyped/Util").singleton;

let threadManager = require("../selftyped/Thread").manager;
import {ThreadT} from "../types/ThreadT";

import {UnsafeBoardT} from "../types/UnsafeBoardT";
let UnsafeBoard = require('../untyped/UnsafeBoard').class;

import {UnsafeHelperT} from "../types/UnsafeHelperT";
let UnsafeHelper = require("../selftyped/UnsafeHelper").class;

import {PrintableContentT} from "../common/Common";
import {InspectObjectT} from "../types/InspectObjectT";
let InspectObject = require("../selftyped/InspectObject").class;

import {RequestT} from "../common/Common";
import {ReplyT} from "../common/Common";

import {SockClient} from "../selftyped/SockClient";


import { MainT} from "../types/MainT";





let Main = function ():MainT {
    let self:MainT = this;

    let thread:ThreadT = threadManager.get("main");

    let clickThru = function(target) {
        window.location.href = target;
    }

    let getElementById = function(path) {
        let el = document.getElementById(path);
        if (!el) {
            throw new Error("Unable to find element: " + path);
        }
        return el;
    }

    self.run = async function() {

        thread.console.info("Connecting to LLM services");

        let llmThread = threadManager.get("llm client")
        let llmClient = new SockClient(llmThread);


        let modelMap = {};


        let buildModelMap = async function() {

            thread.console.info("Requesting model map")
            modelMap = await llmClient.sendRequest("loadModelMap");
            thread.console.debug("modelMap", modelMap)

            // rebuild model list
            let modelList:HTMLElement = getElementById("model-list") as HTMLSelectElement;

            let modelNames = Object.keys(modelMap);
            thread.console.debug("model names", modelNames);

            modelList.innerHTML = "";

            if (modelNames.length) {
                thread.console.info(modelNames.length + " model(s) found");

                modelNames.map(function(modelName) {

                    thread.console.info("Doing model " + modelName);

                    let clients = modelMap[modelName];
                    let clientNames = Object.keys(clients);

                    thread.console.info(clientNames.length + " clients found");

                    clientNames.map(function(clientId) {

                        thread.console.info("Doing client " + clientId);

                        let model = clients[clientId];

                        thread.console.debug("model", model)

                        let item = document.createElement("div");
                        item.innerText = model.service + "." + model.model
                        modelList.appendChild(item);
                    })

                });

            } else {
                thread.console.info("No models found");

                let item = document.createElement("div");
                item.innerText = "No model(s) found";
                modelList.appendChild(item);

            }


        }

        // open websocket to editor server
        await llmClient.connect("");

        llmClient.wsocket.on("llm_announce", async function(service, model) {

            try {

                thread.console.info("Received LLM announce [" + service + "." + model + "]");
                buildModelMap();

            } catch (err) {
                thread.console.softError("LLM announce failed: " + err.toString());
            }

        });

        buildModelMap();
    }



    return self;

}


module.exports = { class: Main };

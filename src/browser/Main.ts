
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

        llmClient.wsocket.on("llm_snapshot", async function(data) {
            thread.console.info("Received LLM snapshot");
        });



        let modelMap = {};


        let buildModelMap = async function() {

            thread.console.info("Requesting model map")
            modelMap = await llmClient.sendRequest("loadModelMap");
            thread.console.debug("modelMap", modelMap)

            // rebuild model list
            let modelList:HTMLElement = getElementById("model-list") as HTMLSelectElement;

            let clientNames = Object.keys(modelMap);
            thread.console.debug("client names", clientNames);

            modelList.innerHTML = "";

            if (clientNames.length) {
                thread.console.info(clientNames.length + " client(s) found");

                clientNames.map(function(clientName, i) {

                    thread.console.info("Doing client " + clientName);

                    let client = modelMap[clientName];

                    thread.console.debug("client", client)

                    let item = document.createElement("div");
                    item.style.display = 'grid'
                    item.style.boxSizing = "border-box"
                    item.style.gridTemplateColumns = "5% 45% 10% 10% 30%"
                    item.style.whiteSpace = "nowrap";
                    item.style.cursor = 'pointer';

                    item.addEventListener('mouseover', function() {
                        item.style.backgroundColor = '#aaa';
                        item.style.color = 'blue';
                    });

                    item.addEventListener('mouseout', function() {
                        item.style.backgroundColor = '';
                        item.style.color = '';
                    });

                    item.addEventListener('click', async function() {
                        thread.console.info("Sending test")
                        await llmClient.sendRequest("test", {
                            clientId: client.clientId,
                            data: "hello there"
                        });
                    });


                    let clientType = "Chrome";
                    if (client.hostId.indexOf("Edg")>= 0) {
                        clientType = "Edge"
                    } else if (client.hostId.indexOf("Brave")>= 0) {
                        clientType = "Brave"
                    }

                    item.innerHTML = "<div>" + (i+1) + "</div><div>" + client.clientId + "</div><div>" + clientType + "</div><div>" + client.service + "</div><div>" + client.model + "</div>";

                    modelList.appendChild(item);
                    item.scrollIntoView(false);

                });


            } else {
                thread.console.info("No clients found");

                let item = document.createElement("div");
                item.innerText = "No client(s) found";
                modelList.appendChild(item);

            }


        }



        buildModelMap();
    }



    return self;

}


module.exports = { class: Main };

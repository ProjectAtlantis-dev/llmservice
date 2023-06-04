
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
        let selectedItem;

        let history = ['foobar'];
        let historyCursor = null;

        let sendButton = getElementById('model-send') as HTMLButtonElement;

        let inputArea = getElementById("model-input") as HTMLInputElement;
        inputArea.addEventListener('keydown', function(event) {
            if (!history.length) {
                thread.console.debug("Nothing in history")
                return;
            }

            thread.console.debug("history", history);

            if (event.key === 'ArrowUp') {
                if (historyCursor === null) {
                    historyCursor = history.length-1;
                    thread.console.debug("History set to " + historyCursor)
                }

                thread.console.info("History back")

                if (historyCursor > 0) {
                    historyCursor--;
                }
                inputArea.value = history[historyCursor];
            } else if (event.key === 'ArrowDown') {
                if (historyCursor === null) {
                    thread.console.debug("No history cursor")
                    return;
                }

                thread.console.info("History fwd")

                if (historyCursor < (history.length - 1)) {
                    historyCursor++;
                    thread.console.debug("History set to " + historyCursor)
                    inputArea.value = history[historyCursor];
                } else {
                    inputArea.value = "";
                }

                if (historyCursor === (history.length - 1)) {
                    historyCursor = null;
                }

            }
        });

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

                    item["_client"] = client;

                    /*
                    item.addEventListener('mouseover', function() {
                        item.style.backgroundColor = '#aaa';
                        item.style.color = 'blue';
                    });

                    item.addEventListener('mouseout', function() {
                        item.style.backgroundColor = '';
                        item.style.color = '';
                    });
                    */

                    item.addEventListener('click', async function() {

                        if (selectedItem) {
                            selectedItem.classList.remove('selected');
                            sendButton.disabled = true;

                            if (item === selectedItem) {
                                selectedItem = null;
                                return;
                            }

                        }

                        item.classList.add('selected');
                        selectedItem = item;
                        sendButton.disabled = false;

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

                sendButton.addEventListener('click', async function() {

                    if (selectedItem) {

                        let client = selectedItem["_client"];

                        if (!client) {
                            thread.console.softError("No client found on selected object");
                            return;
                        }

                        thread.console.debug("selected client", client)

                        if (inputArea.value) {
                            thread.console.info("Sending " + inputArea.value);

                            await llmClient.sendRequest("test", {
                                clientId: client.clientId,
                                data: inputArea.value
                            });

                            history.push(inputArea.value);
                            inputArea.value = "";
                        }

                    }
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


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

        // open websocket to llm server
        await llmClient.connect("");


        let modelOutput = getElementById("model-output");

        llmClient.wsocket.on("snapshot", async function(client) {
            thread.console.info("Received LLM snapshot");

            thread.console.debug("snapshot", client)

            modelOutput.innerText = client.data;

            //modelOutput.scrollIntoView(false);
            modelOutput.scrollTop = modelOutput.scrollHeight;
        });



        let modelMap = {};
        let selectedClient;

        let history = [];
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
            modelList.style.display = "block";

            modelList.innerHTML = "";
            modelList.style.boxSizing = "border-box"

            let clientNames = Object.keys(modelMap).sort();
            thread.console.debug("client names", clientNames);

            if (clientNames.length) {

                let table = document.createElement("table");
                table.style.width = "100%";

                thread.console.info(clientNames.length + " client(s) found");

                clientNames.map(function(clientName, i) {

                    let row = document.createElement("tr");

                    //thread.console.info("Doing client " + clientName);

                    let client = modelMap[clientName];

                    //thread.console.debug("client", client)

                    //let item = document.createElement("div");
                    //item.style.display = 'grid'
                    //item.style.boxSizing = "border-box"
                    //item.style.gridTemplateColumns = "repeat(6, min-content);"
                    row.style.whiteSpace = "nowrap";
                    row.style.cursor = 'pointer';

                    row["_client"] = client;

                    if (selectedClient) {
                        //thread.console.debug("selectedClient", selectedClient)
                        if (selectedClient.clientId === client.clientId) {
                            //row.style.color = 'green';
                            row.classList.add('selected');
                        }
                    }

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

                    row.addEventListener('click', async function() {

                        /*
                        if (selectedItem) {
                            selectedItem.classList.remove('selected');
                            sendButton.disabled = true;

                            if (row["client"].clientId === selectedItem["client"].clientId) {
                                selectedItem = null;
                                return;
                            }

                        }
                        */

                        row.classList.add('selected');
                        selectedClient = client
                        sendButton.disabled = false;

                    });



                    let makeCell = function() {
                        let cell = document.createElement("td");
                        cell.style.padding = "5px"
                        cell.style.borderRight = "1px solid #9090c0"
                        return cell
                    }

                    {
                        let cell = makeCell()
                        cell.innerText = "" + (i+1)
                        row.appendChild(cell)
                    }

                    {
                        let cell = makeCell()
                        cell.innerText = "" + client.clientId
                        row.appendChild(cell)
                    }

                    {
                        let cell = makeCell()
                        cell.innerText = "" + client.clientType
                        row.appendChild(cell)
                    }

                    {
                        let cell = makeCell()
                        cell.innerText = "" + client.service
                        row.appendChild(cell)
                    }

                    {
                        let cell = makeCell()
                        cell.innerText = client.model
                        row.appendChild(cell)
                    }

                    {
                        let cell = makeCell();
                        let lastSeenTxt = client.lastSeen.getHours().toString().padStart(2,'0') + ":" +
                                          client.lastSeen.getMinutes().toString().padStart(2,'0') + ":" +
                                          client.lastSeen.getSeconds().toString().padStart(2,'0');
                        cell.innerText = lastSeenTxt;

                        let now = new Date();
                        let secondsSince = (now.getTime() - client.lastSeen.getTime())/1000;
                        if (secondsSince > 90) {
                            row.style.color = 'red'
                        } else if (secondsSince > 60) {
                            row.style.color = 'yellow'
                        }
                        row.appendChild(cell)
                    }

                    table.appendChild(row);
                    //row.scrollIntoView(false);

                });

                modelList.appendChild(table)



            } else {
                thread.console.info("No clients found");

                let item = document.createElement("div");
                item.innerText = "No client(s) found";
                modelList.appendChild(item);

            }


        }

        setInterval(function() {
            buildModelMap();
        },2000)


        sendButton.addEventListener('click', async function() {

            thread.console.info("Send button got click")

            if (selectedClient) {

                let client = selectedClient;

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


    }



    return self;

}


module.exports = { class: Main };

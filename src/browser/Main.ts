
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
import {ClientT} from "../common/Common";
import {ClientMapT}  from "../common/Common";
import {MessageT} from "../common/Common";
import {MiniRequestT} from "../common/Common";

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


        let clientBufferMap = {};
        let modelMap:ClientMapT = {};
        let selectedClient:ClientT;
        let selectedRequest:string;

        let history = [];
        let historyCursor = null;



        thread.console.info("Connecting to LLM services");

        let llmThread = threadManager.get("llm client")
        let llmClient = new SockClient(llmThread);

        // open websocket to llm server
        await llmClient.connect("");


        let modelOutput = getElementById("model-output");


        llmClient.wsocket.on("snapshot", async function(message:MessageT) {
            thread.console.info("Received LLM snapshot");

            thread.console.debug("snapshot", message);

            if (!message.requestId) {
                thread.console.warn("Snapshot lacks request id")
            }

            if (Reflect.has(clientBufferMap, message.clientId)) {
                clientBufferMap[message.clientId] += message.data || "";
            } else {
                clientBufferMap[message.clientId] = message.data || "";
            }

            if (selectedClient.clientId === message.clientId) {
                // refresh
                modelOutput.innerText = clientBufferMap[message.clientId];
                modelOutput.scrollTop = modelOutput.scrollHeight;
            }

            buildModelMap()


        });




        let sendButton = getElementById('model-send') as HTMLButtonElement;

        let inputArea = getElementById("model-input") as HTMLInputElement;
        inputArea.addEventListener('keydown', function(event) {



            if (event.key === 'ArrowUp') {

                if (!history.length) {
                    thread.console.debug("Nothing in history")
                    return;
                }

                thread.console.debug("history", history);

                if (historyCursor === null) {
                    historyCursor = history.length-1;
                    thread.console.debug("History set to " + historyCursor)
                } else {
                    thread.console.info("History back")
                    if (historyCursor > 0) {
                        historyCursor--;
                    }

                }

                inputArea.value = history[historyCursor];
            } else if (event.key === 'ArrowDown') {

                if (!history.length) {
                    thread.console.debug("Nothing in history")
                    return;
                }

                thread.console.debug("history", history);

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
                    historyCursor = null;
                    inputArea.value = "";
                }


            }
        });



        let buildModelMap = async function() {

            //thread.console.info("Requesting model map")
            modelMap = await llmClient.sendRequest("loadTelemetry") as ClientMapT;
            thread.console.debug("modelMap", modelMap)

            if (selectedClient) {
                // refresh selected client
                selectedClient = modelMap[selectedClient.clientId]
            } else {
                modelOutput.innerText = "";
            }

            // rebuild model list
            let modelList:HTMLElement = getElementById("model-list") as HTMLSelectElement;
            modelList.style.display = "block";
            modelList.style.boxSizing = "border-box"

            modelList.innerHTML = "";


            let clientNames = Object.keys(modelMap).sort();
            thread.console.debug("client names", clientNames);

            if (clientNames.length) {

                let table = document.createElement("table");
                table.style.width = "100%";

                //thread.console.info(clientNames.length + " client(s) found");

                clientNames.map(function(clientName, i) {

                    let row = document.createElement("tr");

                    thread.console.info("Doing client " + clientName);

                    let client = modelMap[clientName];

                    //thread.console.debug("client", client)

                    row.style.whiteSpace = "nowrap";
                    row.style.cursor = 'pointer';

                    row["_client"] = client;

                    if (selectedClient) {
                        //thread.console.debug("selectedClient", selectedClient)
                        if (selectedClient.clientId === client.clientId) {
                            //row.style.color = 'green';
                            row.classList.add('selected');
                            selectedClient["_row"] = row;
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

                        if (selectedClient) {
                            if (selectedClient["_row"]) {
                                selectedClient["_row"].classList.remove('selected');
                            }

                            if (client.clientId === selectedClient.clientId) {
                                // deselect
                                selectedClient = null;
                                sendButton.disabled = true;
                                return;
                            }
                        }

                        row.classList.add('selected');
                        selectedClient = client;
                        sendButton.disabled = false;

                        modelOutput.innerText = clientBufferMap[selectedClient.clientId] || "";
                        modelOutput.scrollTop = modelOutput.scrollHeight;

                        buildModelMap();

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

                        if (client.status === "BAD") {
                            row.style.color = 'red'
                        } else if (client.status === "GOOD") {
                            // leave default
                        } else {
                            row.style.color = 'yellow'
                        }
                        row.appendChild(cell)
                    }

                    table.appendChild(row);


                });

                modelList.appendChild(table)


                let requestList:HTMLElement = getElementById("request-list") as HTMLSelectElement;
                requestList.style.display = "block";
                requestList.style.boxSizing = "border-box"
                requestList.innerHTML = "";

                if (selectedClient) {

                    thread.console.debug("selected client", selectedClient)

                    let table = document.createElement("table");
                    table.style.width = "100%";

                    if (!Reflect.has(selectedClient, "requestMap")) {
                        thread.console.softError("client lacks request map")
                    } else {

                        let lastRow;
                        Object.keys(selectedClient.requestMap).map(function(rid, i) {

                            let row = lastRow = document.createElement("tr");
                            row.style.whiteSpace = "nowrap";
                            row.style.cursor = 'pointer';

                            let request = selectedClient.requestMap[rid];

                            let makeCell = function() {
                                let cell = document.createElement("td");
                                cell.style.padding = "5px"
                                cell.style.borderRight = "1px solid #9090c0"
                                return cell
                            }

                            {
                                let cell = makeCell()
                                cell.innerText = rid
                                row.appendChild(cell)
                            }

                            {
                                let cell = makeCell()
                                cell.innerText = request.lastSeen.toString()
                                row.appendChild(cell)
                            }

                            {
                                let cell = makeCell()
                                if (request["DEAD"]) {
                                    cell.innerText = "done"
                                } else if (request["elapsed"]) {
                                    cell.innerText = request["elapsed"]
                                } else {
                                    cell.innerText = "pending";
                                }
                                row.appendChild(cell)
                            }

                            table.appendChild(row);

                        });

                        requestList.appendChild(table)
                        lastRow.scrollIntoView(false);
                    }

                } else {
                    thread.console.info("No selected client");
                }

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

                    let miniRequest:MiniRequestT = {
                        clientId: client.clientId,
                        data: inputArea.value
                    }
                    await llmClient.sendRequest("test", miniRequest)

                    if (inputArea.value != history[0]) {
                        history.push(inputArea.value);
                    }
                    inputArea.value = "";
                    historyCursor = null;
                }

            }
        });


    }



    return self;

}


module.exports = { class: Main };

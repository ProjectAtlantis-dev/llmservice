
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


import { EditorT} from "../types/EditorT";





let Editor = function ():EditorT {
    let self:EditorT = this;

    let thread:ThreadT = threadManager.get("main");

    let inspectThread = threadManager.get("inspect");
    let inspectObject:InspectObjectT = new InspectObject(inspectThread);

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


    let messages = getElementById('messages');
    let feedback = getElementById('feedback');
    let editorFooterStatus = getElementById("editorFooterStatus")
    let chatFooterStatus = getElementById("chatFooterStatus")

    self.run = async function(monacoEditor, editorCallbackObj,mermaid,d3) {

        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            useMaxWidth: true
        });

        // mermaid zoom
        let makeZoom = function () {
            let svgs = d3.selectAll(".mermaid svg");
            svgs.each(function() {
                var svg = d3.select(this);
                svg.html("<g>" + svg.html() + "</g>");
                var inner = svg.select("g");
                var zoom = d3.zoom().on("zoom", function(event) {
                    inner.attr("transform", event.transform);
                });
                svg.call(zoom);
            });
        };





        let doTimestamp = function() {
            let now = new Date();
            return '<div style="color: #c0c0f0">' + now.toLocaleString() + ': </div>';
        }

        // make sure you have enough whitepsace padding around mermaid stuff or you get syntax error
        // (python side handles this now)
        let commandCnt = 0;
        let _doMarkdown = async function(text, style) {
            commandCnt++;
            let tag = "command_user_" + commandCnt;

            if (!style) {
                style = ""
            }

            //text = text.trim()

            // offload to the python offworlds
            let html = text;
            try {
                html = await pyClient.sendRequest("markdown", text);
            } catch (err) {
                doError("Markdown conversion failed: " + err.toString());
                style += "white-space: pre;"
            }

            feedback.innerHTML += `<div id='${tag}' class="markdown-body" style="${style}">` + html + `</div>`;

            // @ts-ignore
            hljs.highlightAll();

            try {
                await mermaid.run({
                    querySelector: '.mermaid',
                    suppressErrors: true,
                });
                makeZoom();
            } catch (err) {
                doError("Mermaid failed: " + err.toString())
            }

            let el = getElementById(tag)
            el.scrollIntoView(false)

        }

        let doUserMarkdown = async function(text) {
            await _doMarkdown(text, "background-color:  #353543;");
        }

        let doMarkdown = async function(text) {
            await _doMarkdown(text, null);
        }


        let messageCnt = 0;

        let doData = function(data) {

            messageCnt++;
            let tag = "message_data_" + messageCnt;

            let printable = inspectObject.objectToHTML(data, {});
            let buffer = printable.htmlOutput;
            messages.innerHTML += "<div style='white-space:pre; display:flex;flex-direction:row;'>" + doTimestamp() + '</div>';
            messages.innerHTML += `<div id=${tag} style='white-space:pre'>` + buffer + '</div>';

            let el = getElementById(tag)
            el.scrollIntoView(false)

        }

        function escapeHtml(unsafe) {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(unsafe));
            return div.innerHTML;
        }

        let doMessage = function(color,message) {

            message = escapeHtml(message);
            thread.console.debug("message", message)

            messageCnt++;
            let tag = "message_" + messageCnt;

            if (!color) {
                color = "#c0c0f0"
            }

            messages.innerHTML +=
                `<div id=${tag} style='white-space:pre-wrap; display:flex;flex-direction:row;padding-bottom:1px;'>` +
                doTimestamp() +
                '<span style="flex:1; padding-left:1ch; color:' + color + '; ">' + message + '</span></div>';

            let el = getElementById(tag)
            el.scrollIntoView(false)
        }

        let doInfo = function(data) {
            doMessage("#fff", data)
        }

        let doWarn = function(data) {
            doMessage("#FFFF00", data)
        }

        let doError = function(data) {
            doMessage("#F00", "ERROR: " + data)
        }

        let doInput = function(data) {
            doMessage(null, data)
        }

        let doAttention = function(data) {
            doMessage("#00D8D8", data)
        }





        thread.console.debug("Connecting to python services")

        let pythonThread = threadManager.get("python client")
        let pyClient = new SockClient(pythonThread);
        // open websocket to python service
        await pyClient.connect("ws://localhost:3050/");

        pyClient.onError = function(ws, message) {
            doError(message)
        };

        pyClient.onConnect = function(ws, firstTime) {
            if (firstTime) {
                messages.innerHTML = '';
                console.log('Connected to the server');
            }
        };


        let helperThread = threadManager.get("unsafe-helper");
        let unsafeHelper:UnsafeHelperT = new UnsafeHelper(helperThread);
        let resultBoard:UnsafeBoardT = new UnsafeBoard(thread, null, {});

        pyClient.wsocket.on('message', function(message) {

            if (message.type === "info") {
                doInfo(message.data)
            } else if (message.type === "warn") {
                doWarn(message.data)
            } else if (message.type === "error") {
                doError(message.data)
            } else if (message.type === "input") {
                doInput(message.data)
            } else if (message.type === "attention") {
                doAttention(message.data)
            } else if (message.type === "data") {

                try {

                    let buffer = message.data;

                    thread.console.bold("Received data " + buffer);

                    let data = unsafeHelper.extractUnsafeJSO(helperThread, buffer, resultBoard);
                    doInfo("Received data")
                    doData(data);

                } catch (err) {
                    thread.console.softError("Data failed: " + err.toString());
                }

            } else {
                console.log("ERROR: Unrecognized message type " + message.type)
                console.log(message)
            }

        });


        /*

        pyClient.wsocket.on('data', function(buffer) {

            try {

                thread.console.bold("Received data " + buffer);

                let data = unsafeHelper.extractUnsafeJSO(helperThread, buffer, resultBoard);
                doInfo("Received data")
                doData(data);

            } catch (err) {
                thread.console.softError("Data failed: " + err.toString());
            }


        });
        */



        // Handle the 'reply' event
        /*
        pyClient.wsocket.on('reply', function(data) {
            console.log("Got server reply: " + data)
            doMessage("#fff", data)
        });
        */

        // Send a message to the server when the send button is clicked
        /*
        var sendButton = getElementById('send-button');
        sendButton.addEventListener('click', function() {
            let messageInput = getElementById('message-input');
            sendMessage()
            messageInput.focus();
        });
        */

        // Add an event listener for the 'keydown' event on the message-input element.
        /*
        getElementById('message-input').addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
        */


        // Send a message to the server
        /*
        function sendMessage(message) {
            console.log("Sending regular message: " + message);
            socket.emit('message', message);
        }
        */

        /*
        socket.on('remote_request', function(msg) {
            console.log('Received remote request');

            const {command, data, handle} = JSON.parse(msg);

            console.log('Command:', command);
            console.log('Data:', data);
            console.log('Handle:', handle);

            // Perform the desired action based on the received command and data.
            // In this example, we simply echo back the received data

            doMessage("#fff", command)

            replyPending = handle;
        });
        */



        thread.console.info("Connecting to editor services");

        let editorThread = threadManager.get("editor client")
        let editorClient = new SockClient(editorThread);


        /*
        type BotT = {
            model: string
        }
        type ConfigT = {
            concierge: BotT
        }
        let config:ConfigT = await editorClient.sendRequest("loadConfig");
        thread.console.debug("config", config)
        */
        //await editorClient.sendRequest("saveConfig", config);

        let modelMap = {};

        editorCallbackObj.run = async function(buffer, range, content) {

            thread.console.info("content:\n" + content)

            await doUserMarkdown(content);

            // fire and forget
            editorClient.sendRequest("saveEditorContent", content)

            try {


                /*
                if (!config.concierge) {
                    doMarkdown("Concierge not found; doing first time setup");

                    config.concierge = {
                        model: "gpt-4"
                    }
                }

                let f = pyClient.getFunction("first time setup")
                if (!f) {

                }
                */

                /*
                    let data = {
                        model: config.concierge.model,
                        prompt: `
Pretend you are a new computer system and you need to set up a new user.
What are some pieces of information you would want to collect?
`,
                    }


                }
                */


                // text-davinci-002-render-sha


                let data = {
                    //model: "text-davinci-003",
                    model: "gpt-4",
                    prompt: content,
                    maxTokens: 2048
                }

                /*
                let data =  {
                    //model: "gpt-3.5-turbo",
                    //model: "text-davinci-002-render-sha",
                    messageData: [
                        {
                            role: "user",
                            content,
                        }
                    ],
                    maxTokens: 1024
                }
                */

                doInput("Sending")
                doData(data);
                let result = await pyClient.sendRequest("llm", data);


                // @ts-ignore
                /*
                const [ response ] = await window.ai.generateText({
                    messages: [
                        {
                            role: "user",
                            content
                        }
                    ],
                    options: {
                        temperature: 0.7,
                        maxTokens: 800,
                        // @ts-ignore
                        model: window.ai.ModelID.GPT_4,
                        // Handle partial results if they can be streamed in
                        onStreamResult: (res) => console.log(res.message.content)
                    }
                });

                thread.console.debug("window ai response", response)

                let result = response.message.content
                console.log(response.message.content) // "I am an AI language model"
                */

                await doMarkdown(result)
            } catch (err) {
                thread.console.softError(err.toString())
                doError(err.toString())
            }

        }

        editorCallbackObj.save = async function(buffer, range, content) {
            thread.console.info("Got save request")
            editorClient.sendRequest("saveEditorContent", content)
            chatFooterStatus.innerText = "Editor contents saved"
        }

        editorCallbackObj.clear = async function(buffer, range, content) {
            thread.console.info("Got clear request")
            monacoEditor.setValue("")
        }

        editorCallbackObj.keydown = async function(buffer, range, content) {
            //thread.console.info("Got keydown")
            let modelSelect = document.getElementById("model-select") as HTMLSelectElement;

            let tokenCount = await pyClient.sendRequest("tokens", {
                model: modelSelect.value,
                buffer: content
            })
            editorFooterStatus.innerText = "Tokens: " + tokenCount

        }

        // open websocket to editor server
        await editorClient.connect("");

        if (!monacoEditor) {
            throw new Error("Editor not provided to main")
        }


        let buildModelMap = async function() {
            modelMap = await editorClient.sendRequest("loadModelMap");
            thread.console.debug("modelMap", modelMap)

            // rebuild model list
            let modelSelect:HTMLSelectElement = getElementById("model-select") as HTMLSelectElement;
            modelSelect.options.length = 0;

            let modelNames = Object.keys(modelMap);
            thread.console.debug("model names", modelNames);

            modelNames.map(function(modelName) {

                thread.console.info("Doing model " + modelName);

                let clients = modelMap[modelName];

                Object.keys(clients).map(function(clientId) {

                    thread.console.info("Doing client " + clientId);

                    let model = clients[clientId];

                    thread.console.debug("model", model)

                    let option = document.createElement("option");

                    option.value = model.service + "." + model.model
                    option.text = modelName;

                    modelSelect.appendChild(option);
                })
            });


        }

        editorClient.wsocket.on("llm_announce", async function(service, model) {

            try {

                doInfo("Received LLM announce [" + service + "." + model + "]");
                buildModelMap();

            } catch (err) {
                thread.console.softError("LLM announce failed: " + err.toString());
            }

        });

        thread.console.debug("Loading editor content")
        let reply = await editorClient.sendRequest("loadEditorContent")
        thread.console.debug("request reply: " + reply)
        monacoEditor.setValue(reply);

        let tokenCount = await pyClient.sendRequest("tokens", {
            model: "unused",
            buffer: reply
        })
        editorFooterStatus.innerText = "Tokens: " + tokenCount

        // go to last line
        const lastLine = monacoEditor.getModel().getLineCount();
        const lastColumn = monacoEditor.getModel().getLineLastNonWhitespaceColumn(lastLine);
        monacoEditor.setPosition({ lineNumber: lastLine, column: lastColumn });
        monacoEditor.revealLineInCenter(lastLine);
        monacoEditor.focus();

        buildModelMap();
    }



    return self;

}


module.exports = { class: Editor };

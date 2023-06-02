
let moment = require('moment');
let PromiseB = require('bluebird');

let util = require("../untyped/Util").singleton;

let threadManager = require("../selftyped/Thread").manager;
import {ThreadT} from "../types/ThreadT";

import {UnsafeBoardT} from "../types/UnsafeBoardT";
let UnsafeBoard = require('../untyped/UnsafeBoard').class;

import {UnsafeHelperT} from "../types/UnsafeHelperT";
let UnsafeHelper = require("../selftyped/UnsafeHelper").class;

import {PrintableContentT} from "../common/BotCommon";
import {InspectObjectT} from "../types/InspectObjectT";
let InspectObject = require("../selftyped/InspectObject").class;


import {SockClient} from "../selftyped/SockClient";


import { MainT} from "../types/MainT";




let Main = function ():MainT {
    let self:MainT = this;

    let thread:ThreadT = threadManager.get("main");

    let inspectThread = threadManager.get("inspect");
    let inspectObject:InspectObjectT = new InspectObject(inspectThread);

    self.run = async function() {

        thread.console.info("Starting main");

        let urlParams = new URLSearchParams(window.location.search);

        let url = ""
        if (urlParams.has("backend")) {
            let port = urlParams.get("backend")
            url = "ws://127.0.0.1:" + port + "/";
        }

        let client = new SockClient();
        await client.connect(url);



        function scrollToBottom(messages) {
            messages.scrollTop = messages.scrollHeight;
        }

        // Create a MutationObserver to watch for changes in the messages div
        var messagesObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    var messages = document.getElementById('messages');
                    scrollToBottom(messages);
                }
            });
        });

        let messages = document.getElementById('messages');
        messagesObserver.observe(messages, { childList: true });


        let doTimestamp = function() {
            let now = new Date();
            return '<div style="color: #c0c0f0">' + now.toLocaleString() + ': </div>';
        }

        let doMessage = function(color,message) {

            if (!color) {
                color = "#c0c0f0"
            }

            messages.innerHTML += "<div style='white-space:pre; display:flex;flex-direction:row;align-items:center'>" + doTimestamp() + '<p style="padding-left:1ch; color:' + color + '">' + message + '</p></div>';
        }

        let doData = function(data) {
            let printable = inspectObject.objectToHTML(data, {});
            let buffer = printable.htmlOutput;
            messages.innerHTML += "<div style='white-space:pre; display:flex;flex-direction:row;align-items:center'>" + doTimestamp() + '</div>';
            messages.innerHTML += "<div style='white-space:pre'>" + buffer + '</div>';
        }

        let socket = client.wsocket
        let console = thread.console

        client.onConnect = function(ws, firstTime) {
            if (firstTime) {
                messages.innerHTML = '';
                console.log('Connected to the server');
            }
        };

        socket.on('info', function(data) {
            console.log("Got server info: " + data)
            doMessage("#fff", data)
        });

        socket.on('warn', function(data) {
            console.log("Got server warning: " + data)
            doMessage("#FFFF00", data)
        });

        socket.on('error', function(data) {
            console.log("Got server error: " + data)
            doMessage("#F00", data)
        });

        socket.on('input', function(data) {
            console.log("Got user input: " + data)
            doMessage(null, data)
        });

        socket.on('attention', function(data) {
            console.log("Got server attention: " + data)
            doMessage("#00D8D8", data)
        });

        let helperThread = threadManager.get("unsafe-helper");
        let unsafeHelper:UnsafeHelperT = new UnsafeHelper(helperThread);
        let resultBoard:UnsafeBoardT = new UnsafeBoard(thread, null, {});

        socket.on('data', function(buffer) {

            try {

                thread.console.bold("Received data " + buffer);

                let data = unsafeHelper.extractUnsafeJSO(helperThread, buffer, resultBoard);
                doData(data);

            } catch (err) {
                thread.console.softError("Data failed: " + err.toString());
            }


        });



        /*
        // Handle the 'reply' event
        socket.on('reply', function(data) {
            console.log("Got server reply: " + data)
            doMessage("#fff", data)
        });
        */

        // Send a message to the server when the send button is clicked
        var sendButton = document.getElementById('send-button');
        sendButton.addEventListener('click', function() {
            let messageInput = document.getElementById('message-input');
            sendMessage()
            messageInput.focus();
        });


        // Add an event listener for the 'keydown' event on the message-input element.
        document.getElementById('message-input').addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });


        let replyPending

        // Send a message to the server
        function sendMessage() {

            let messageInput = document.getElementById('message-input') as HTMLInputElement;
            let message = messageInput.value;
            messageInput.value = '';
            if (replyPending) {

                const response = {
                    handle: replyPending,
                    data: message,
                    error: null
                };

                replyPending = null;
                socket.emit('remote_reply', JSON.stringify(response));


            } else {
                console.log("Sending regular message: " + message);
                socket.emit('message', message);
            }

        }


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

        socket.on('title', function(msg) {
            document.getElementById("title")
            title.innerText = msg
        })
        */

        /*
        const eventSource = new EventSource('/updates2');

        eventSource.onmessage = function(event) {
            console.log("Got server event", event)
            doMessage("#fff", event.data)
        };
        */

    }



    return self;

}


module.exports = { class: Main };

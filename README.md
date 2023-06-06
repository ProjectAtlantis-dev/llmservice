# llmservice

Not for commercial use!

This service connects Python clients to browsers using ChatGPT Poe etc. This is meant to be used in conjunction with the browser extension

Exposes HTTP endpoint /llm on port 3010 for use by a client (see Python llmwrapper) to submit LLM requests by service name and model name (see web page below)

This serves an admin web page on port 3010 that shows which extensions are connected (and exposes socket.io surface for use by the monitoring page)


![LLM Service Screenshot](./docs/llmservice.gif)



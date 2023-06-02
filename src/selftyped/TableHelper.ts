/* eslint-disable @typescript-eslint/naming-convention */

let moment = require('moment');

import {UtilT} from "../types/UtilT";
let util:UtilT = require('../untyped/Util').singleton;


import {PrettyT} from "../types/PrettyT";
let pretty:PrettyT = require('../untyped/Pretty').singleton;


import {ThreadT} from "../types/ThreadT";

import {DocumentShimT} from "../types/DocumentShimT";
import {HTMLElementShimT} from "../types/HTMLElementShimT";

import {TabDataFieldColorT} from "../common/Common";
import {TabDataFieldMapT} from "../common/Common";

import {TableHelperT} from "../types/TableHelperT";


type TextObjectT = {

    info?: string,
    error?: string,

    style?: any
};



let TableHelper = function (thread:ThreadT, document:DocumentShimT, content:HTMLElementShimT):TableHelperT {
    let self:TableHelperT = this;

    let elementCnt = 0;

    let pushContent = function(element) {
        // must be pushed immediately or else focus etc. does not work ?
        content.appendChild(element);
    };


    let makeRow = function(key:number) {
        let rowElement = document.createElement("div");
        //rowElement.classList.add("bot-table-row");
        rowElement.id = "row_" + key;

        return rowElement;
    };


    let pushOutput = function(logObj:TextObjectT) {

        //console.log(logObj);

        let key = elementCnt++;
        let rowElement = makeRow(key);

        // need to create another nested div (otherwise changes to background will fill the padding)

        let nextElement = document.createElement("div");
        nextElement.classList.add("bot-table-text");
        nextElement.style.display = "inline-block";
        nextElement.id = "bot-table-text-output-" + key;

        // color defaults
        if (logObj.info) {
            nextElement.style.color = "#555588";
            nextElement.style.backgroundColor = "transparent";
            nextElement.innerHTML = logObj.info;

        } else if (logObj.error) {
            nextElement.style.color = "#fff";
            nextElement.style.backgroundColor = "#8E0500";
            nextElement.innerHTML = logObj.error;

        } else {
            thread.console.softError("Unknown data received");
            thread.console.debug("log data", logObj);
            return;
        }

        if (!logObj.error) {
            nextElement.style.textShadow = "1px 1px 2px black";
        }


        if (logObj.style) {
            // textAlign: right
            util.merge(nextElement.style, logObj.style);
        }


        rowElement.appendChild(nextElement);
        pushContent(rowElement);

        // make sure end is visible ? if content does not fill screen this has the annoying result of pulling down tables


    };


    self.render = function(colDefs:TabDataFieldMapT, data:Array<Object>) {

        if (!data.length){
            pushOutput({
                info: "No rows found",
            });
            return;
        }

        pushOutput({
            info: "Total " + data.length + " row(s)",
        });


        //thread.console.debug("table data", data);

        if (!colDefs) {
            /*
            self.pushOutput({
                warn: "No column info provided, using defaults"
            });
            */
            colDefs = {};
            thread.console.debug("No coldefs provided by server");
        } else {
            //thread.console.debug("coldefs from server", colDefs);
        }

        // fill in any missing type info; PRESERVE col order !!
        let renderColDefs:TabDataFieldMapT = {};
        let firstRow = data[0];
        if (data.length > 0) {
            renderColDefs["_cnt"] = {
                type: "number",
                title: "",
                color: {
                    fg:  "#555588"
                }
            };
        }
        Object.keys(firstRow).map(function(colName) {
            renderColDefs[colName] = colDefs[colName] || {};
        });
        util.merge(renderColDefs, colDefs); // pick up any missing

        Object.keys(renderColDefs).map(function(colName) {

            let colDef = renderColDefs[colName];

            if (!colDef.type) {

                // scan until we find defined data
                let sampleValType = "undefined";
                let sampleRowIdx = 0;
                while ((sampleValType === "undefined" || sampleValType === "null") && sampleRowIdx < data.length && sampleRowIdx < 50) {
                    let sampleRow = data[sampleRowIdx];
                    if (sampleRow) {
                        let sampleVal = data[sampleRowIdx][colName];
                        sampleValType = util.valueType(sampleVal);
                        if (sampleValType === 'string') {
                            if (util.isNumeric(sampleVal)) {
                                if (util.isFloat(sampleVal)) {
                                    sampleValType = 'float';
                                } else {
                                    sampleValType = 'integer';
                                }
                            } else if (util.isDate(sampleVal)) {
                                sampleValType = 'date';
                            }
                        } else if (sampleValType === "number") {
                            if (util.isFloat(sampleVal)) {
                                sampleValType = 'float';
                            } else {
                                sampleValType = 'integer';
                            }
                        }
                    } else {
                        pushOutput({
                            error: "Empty row at offset " + sampleRowIdx + "; please check source data"
                        });
                    }
                    sampleRowIdx++;
                }

                colDef.type = sampleValType;
                //thread.console.info("Column [" + colName + "] auto-assigned to " + sampleValType);
            } else {
                //thread.console.info("Column [" + colName + "] is " + colDef.type);
            }
        });

        //thread.console.info("render colDefs", renderColDefs);

        // wrapper
        let wrapper = document.createElement("div");
        wrapper.classList.add("bot-table");

        let templateFormatStr = "";
        let leadingEdge = true;
        Object.keys(renderColDefs).map(function(colName, idx) {
            let colDef = renderColDefs[colName];

            if (colDef.hidden) {
                //thread.console.info("Column [" + colName + "] is hidden");
                return;
            }

            // THIS STUFF DETERMINES IF A COLUMN GETS SQUEEZED OR NOT
            if (colDef.squeeze) {
                templateFormatStr += "auto ";
            /*
                templateFormatStr += "max-content ";
            } else if (colDef.type === "date") {
                // do NOT squeeze dates
                templateFormatStr += "max-content ";
            } else if (colDef.type === "number" || colDef.type === "float" || colDef.type === "integer") {
                // do NOT squeeze numbers
                templateFormatStr += "max-content ";
            } else if (colDef.type === "string") {
                if (leadingEdge) {
                    templateFormatStr += "max-content ";
                    leadingEdge = false;
                } else if (colDef.expand) {
                    templateFormatStr += "max-content ";
                } else {
                    let minLen = colName.length + 2;
                    if (minLen < 10) {
                        minLen = 10;
                    }
                    templateFormatStr += "minmax(" + minLen + "ch, auto) ";
                }
            */
            } else {
                // everything expanded by default
                templateFormatStr += "max-content ";
            }
        });
        wrapper.style.gridTemplateColumns = templateFormatStr;

        let keys = Object.keys(renderColDefs);

        let doHeaders = function(borderStatus) {
            // header row
            thread.console.info("Processing headers");
            let displayCnt = 0;
            let firstColDisplayed = false;

            keys.map(function(colName, idx) {
                let colDef = renderColDefs[colName];

                if (colDef.hidden) {
                    return;
                }

                displayCnt++;

                //thread.console.debug("header " + colName,colDef);

                let cell = document.createElement("div");
                cell.classList.add("bot-table-header");
                if (Reflect.has(colDef, "title")) {
                    //thread.console.info("Column [" + colDef.title + "] is actually named [" + colName + "]");
                    cell.innerHTML = colDef.title;
                } else {
                    if (colDef.icon) {
                        // leave blank
                    } else {
                        cell.innerHTML = colName;
                    }
                }

                if (borderStatus === 0 || borderStatus === 1) {
                    cell.style.borderBottom = "1px solid #666695";
                }

                if (borderStatus === 1 || borderStatus === 2) {
                    cell.style.borderTop = "1px solid #666695";
                }

                if (!idx) {
                    //upper left corner
                    //cell.onClick = "downloadToCSV()";
                    //cell.style.cursor = "pointer";
                }

                if (firstColDisplayed) {
                    // don't draw left edge on first col displayed
                    cell.style.borderLeft = "1px solid #666695";
                } else {
                    firstColDisplayed = true;
                }

                if (colDef.titleStyle) {
                    util.merge(cell.style, colDef.titleStyle);
                }


                wrapper.appendChild(cell);

            });

            return displayCnt;
        }


        let displayCnt = doHeaders(0);
        if (!displayCnt) {
            // all cols are hidden
            pushOutput({
                error: "All columns are hidden; nothing to display"
            });
            return;
        }

        thread.console.info("Processing data");
        //thread.console.debug("table data", data);


        // data rows
        data.map(function(row, rowIdx) {
            //thread.console.info("row", row);

            if (!(rowIdx % 100) && rowIdx > 0 && rowIdx < data.length-1) {
                doHeaders(1);
            }

            let tr = util.valueType(row);
            if (tr !== 'object') {

                pushOutput({
                    error: "Row contains '" + tr + "' instead of row data object; check data source"
                });
                return;
            }
            // create new div
            let firstColDisplayed = false;
            keys.map(function(colName) {
                let colDef = renderColDefs[colName];

                //thread.console.debug("col def " + colName, colDef);

                if (colDef.hidden) {
                    return;
                }

                let cell = document.createElement("div");
                cell.classList.add("bot-table-cell");
                cell.setAttribute("data-meta",pretty.inspect(row).replace(/\'/g, "\\'").replace(/\"/g, "\'"));
                cell.setAttribute("data-metacol", colName);

                if (firstColDisplayed) {
                    // don't draw left edge on first col displayed
                    cell.style.borderLeft = "1px solid #666695";
                } else {
                    firstColDisplayed = true;
                }

                cell.style.whiteSpace = "nowrap";
                cell.style.overflow = "hidden";

                if (colDef.type === "date" || colDef.type === "when") {
                    cell.style.color = "#00BA73";  // calm green
                } else if (colName.toLowerCase() === "id") {
                    cell.style.color = "#c0c0c0";
                    cell.style.textAlign = "right";
                } else if (colDef.type === "number" || colDef.type === "float" || colDef.type === "integer") {
                    cell.style.color = "#b4821f";  // amber
                    cell.style.textAlign = "right";
                } else if (colDef.type === "object" || colDef.type === "array") {
                    cell.style.color = "#555555";  // dark grey
                } else if (colDef.type === "boolean") {
                    cell.style.color = "#dd7d00";
                } else {
                    // default (string)
                    cell.style.color = "#9090c0";
                }

                // color override
                if (colDef.color) {
                    let ct = util.valueType(colDef.color);
                    if (ct === "string") {
                        cell.style.color = colDef.color as string;
                    } else if (ct === "object" || ct === "array") {
                        let colorObj = colDef.color as TabDataFieldColorT;
                        if (colorObj.fg) {
                            cell.style.color = colorObj.fg;
                        }
                        if (colorObj.bg) {
                            cell.style.backgroundColor = colorObj.bg;
                        }
                    } else if (ct === "function") {
                        let value = row[colName];
                        let obj = (colDef.color as Function).call(null, value);
                        let colorObj = obj as TabDataFieldColorT;
                        thread.console.debug("colorobj", colorObj);
                        if (colorObj.fg) {
                            cell.style.color = colorObj.fg;
                        }
                        if (colorObj.bg) {
                            cell.style.backgroundColor = colorObj.bg;
                        }
                    }
                }

                if (colDef.style) {
                    util.merge(cell.style, colDef.style);
                }

                // default rendering ?
                if (colName === "_cnt") {
                    // zero based row idx or 1-based
                    cell.innerHTML = "" + (rowIdx+1);
                } else {
                    if (Reflect.has(row, colName)) {
                        let value = row[colName];

                        if (colDef.type === "date") {
                            cell.innerHTML = util.formatDate(value);
                        } else if (colDef.type === "when") {
                            cell.innerHTML = moment(value).fromNow();
                        } else if (colDef.type === "url") {
                            let link = document.createElement("a");
                            link.href = value;
                            link.target = "_blank";
                            link.innerHTML = value;
                            cell.appendChild(link);
                        } else if (colDef.type === "imageURL") {
                            let image = document.createElement("img");
                            image.style.height = colDef.height || "75px";
                            image.src = value;
                            cell.appendChild(image);
                        } else if (colDef.type === "number" || colDef.type === "integer" || colDef.type === "float") {
                            if (!value) {
                                cell.innerHTML = '';
                            } else {
                                // we need to be careful of columns that contain both text and numbers
                                if (colDef.type === "float" && value.toFixed) {
                                    cell.innerHTML = value.toFixed(8);
                                } else {
                                    cell.innerHTML = value;
                                }
                            }
                        } else if (colDef.type === "object" || colDef.type === "array") {
                            cell.innerHTML = JSON.stringify(value);
                        } else if (colDef.icon) {
                            cell.innerHTML = colDef.icon;
                        } else {
                            let t = util.valueType(value);
                            if (t === "null" || t === "undefined") {
                                cell.innerHTML = '';
                            } else {
                                cell.innerHTML = value;
                            }
                        }

                        if (colDef.type === "string") {
                            cell.title = value;
                        }

                    } else {
                        thread.console.softError("Unable to find col " + colName);
                        //thread.console.debug("row", row);
                        cell.innerHTML = "?";
                    }
                }


                /*
                if (colDef.render) {

                    let value;
                    if (Reflect.has(row, colName)) {
                        value = row[colName];
                    }

                    try {
                        let rt = colDef.render.call({}, value, cell, row, data, document, colName, colDef.type);
                        if (rt) {
                            // assume this is what we want to render
                            cell.innerHTML = rt;
                        }
                    } catch (err) {
                        thread.console.debug("Failed render row as follows:", row);
                        thread.console.softError("Render failed: " + err);
                    }

                }
                */

                wrapper.appendChild(cell);
            });
        });

        if (data.length > 100) {
            // put headers at end
            doHeaders(2);
        }

        content.appendChild(wrapper);
    };

    return self;
};

module.exports = { class: TableHelper };





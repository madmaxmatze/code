// ==UserScript==
// @name         Google Cloud Shell - Checker
// @namespace    https://mathiasnitzsche.de
// @version      1.0
// @description  Script to check remaining time within Google Cloud Shell quota to avoid being locked out
// @author       Mathias Nitzsche
// @match        https://shell.cloud.google.com/*
// @icon         https://shell.cloud.google.com/favicon.ico
// @grant        none
// @require      https://code.mathiasnitzsche.de/shell/userscript.js
// ==/UserScript==

(function() {
    'use strict';

    function checkTime () {
        fetch('https://shell.cloud.google.com/devshell/quota?authuser=0').then(response => {
            // console.log(JSON.stringify(response) );
            // response.text().then(result => {return console.log(result);});
            response.text().then(result => {
                var [remainingSecs, totalSecs, endDate] = JSON.parse(result.split("\n")[1]).flat()
                console.log("remainingSecs", remainingSecs);
                console.log("totalSecs", totalSecs);
                console.log("endDate", endDate);
                if (remainingSecs < 3 * 3600) {
                    alert("Less then 3 hours left");
                }
            });
        });
    }

    setInterval(checkTime, 5000);
})();

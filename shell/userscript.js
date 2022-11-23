// ==UserScript==
// @name         Google Cloud Shell - Checker
// @namespace    https://mathiasnitzsche.de
// @version      1.1
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
        fetch('https://shell.cloud.google.com/devshell/quota').then(response => {
            response.text().then(textResult => {
                var [remainingSecs, totalSecs, endDate] = JSON.parse(textResult.split("\n")[1]).flat();
                var remainingHours = remainingSecs / 60 / 60;
                console.log("Cloud Quota checked. Remaining hours: ", remainingHours.toFixed(1));
                if (remainingHours < 3) {
                    alert("Less then 3 hours left");
                }
            });
        });
    }

    setInterval(checkTime, 1000 * 60 * 30); // check every 30mins
})();

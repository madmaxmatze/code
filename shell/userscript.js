// ==UserScript==
// @name         Google Cloud Shell - Quota Checker
// @namespace    https://mathiasnitzsche.de
// @version      1.0
// @description  Script to check remaining time within Google Cloud Shell Quota (50h/week) to avoid being locked
// @author       Mathias Nitzsche
// @match        https://shell.cloud.google.com/*
// @icon         https://shell.cloud.google.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    function checkTime() {
        fetch('https://shell.cloud.google.com/devshell/quota').then(response => {
            response.text().then(textResult => {
                var [remainingSecs, totalSecs, endDate] = JSON.parse(textResult.split("\n")[1]).flat();
                var remainingHours = remainingSecs / 60 / 60;
                console.log("Cloud Quota checked. Remaining hours: ", remainingHours.toFixed(1));
                if (remainingHours < 3) {
                    alert(remainingHours + " hours left before Google Cloud Shell Quota is exceeded");
                }
            });
        });
        return checkTime;
    }

    setInterval(checkTime(), 1000 * 60 * 10); // check every 30mins
})();

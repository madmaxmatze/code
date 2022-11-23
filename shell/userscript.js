// source: https://github.com/madmaxmatze/code/tree/main/shell
// UserScript for tampermonkey.net chrome extension

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
        fetch('/devshell/quota')
            .then(response => response.text())
            .then(textResult => textResult.match(/(\d+)/).shift() / 3600)
            .then(remainingHours => {
                console.log(`Cloud Quota checked. Hours remaining: ${remainingHours.toFixed(1)}`);
                if (remainingHours < 3) {
                    alert(remainingHours + " hours left before Google Cloud Shell Quota is exceeded");
                }
            });
        return checkTime;
    }

    setInterval(checkTime(), 1000 * 60 * 30); // check every 30mins
})();

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
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    var authuser = (new URLSearchParams(location.search)).get('authuser') || 0;

    function checkTime() {
        fetch(`/devshell/quota?authuser=${authuser}`)
            .then(response => response.text())
            .then(textResult => textResult.match(/(\d+)/).shift() / 3600)
            .then(remainingHours => {
                 var message = `Cloud Quota checked. Hours remaining: ${remainingHours.toFixed(1)}`;
                 console.log(message);
                 if (remainingHours < 5) {
                     alert(message);
                 }
             });
    }

    checkTime();
    setInterval(checkTime, 1000 * 60 * 30); // every 30mins
})();

// ==UserScript==
// @name         Google Cloud Shell - Quota Checker
// @namespace    https://mathiasnitzsche.de
// @version      1.1
// @description  UserScript for tampermonkey.net chrome extension to check the remaining time within Google Cloud Shell Quota (50h/week) to avoid being locked
// @author       Mathias Nitzsche
// @source       https://github.com/madmaxmatze/code/tree/main/shell
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
            .then(textResult => JSON.parse(textResult.match(/(\[.+\])/g)).flat())
            .then(([remainingSeconds, _totalSeconds, endTimestamp]) => {
                 var remainingHours = Math.round(remainingSeconds / 3600 * 10) / 10;
                 var message = `Cloud Quota checked\n- ${remainingHours} hours are remaining\n- Reset will happen on ${(new Date(endTimestamp)).toLocaleString()}`;
                 console.log(message);
                 if (remainingHours < 3) {
                     alert(message + "\n- This page will redirect in 5mins.");
                     setTimeout(() => {window.location.assign("https://www.google.com")}, 60000 * 5/*min*/);
                 }
             });
    }

    checkTime();
    setInterval(checkTime, 60000 * 30/*min*/);
})();

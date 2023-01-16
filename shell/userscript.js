// ==UserScript==
// @name         Google Cloud Shell - Quota Checker
// @namespace    https://github.com/madmaxmatze
// @version      1.2
// @description  2023-01-15: UserScript for tampermonkey.net chrome extension to check the remaining time within Google Cloud Shell Quota (50h/week) to avoid being locked
// @author       Mathias Nitzsche
// @homepage     https://mathiasnitzsche.de
// @source       https://github.com/madmaxmatze/code/tree/main/shell
// @match        https://shell.cloud.google.com/*
// @icon         https://shell.cloud.google.com/favicon.ico
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    checkNotificationPermission();
    setInterval(checkTime, 60000 * 10/*min*/);
    checkTime();

    function checkNotificationPermission(){
        if (('Notification' in window) && Notification.permission != "granted") {
            alert("The Google Cloud Shell Quota Checker requires notification permissions. Please accept the following request");
            Notification.requestPermission();
        }
    }

    function checkTime() {
        var authuser = (new URLSearchParams(location.search)).get('authuser') || 0;
        fetch("/devshell/quota?authuser=" + authuser)
            .then(response => response.text())
            .then(textResult => JSON.parse(textResult.match(/(\[.+\])/g)).flat())
            .then(([remainingSeconds, _totalSeconds, resetTimestamp]) => handleQuota(remainingSeconds / 3600, resetTimestamp));
    }

    function handleQuota(remainingHours, resetTimestamp) {
        var message = `Cloud Quota checked\n` +
                      `- ${~~(remainingHours * 10) / 10} hours are remaining\n` +
                      `- Reset will happen on ${(new Date(resetTimestamp)).toLocaleString()}`;
        console.log(message);
        if (remainingHours < 3) {
            if (('Notification' in window) && Notification.permission == "granted") {
                new Notification(
                    'Quota about to exceed!!!',
                    { body: message, image: "https://shell.cloud.google.com/favicon.ico" }
                );
            }
            alert(message);
        }
    }
})();

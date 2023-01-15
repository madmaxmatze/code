// ==UserScript==
// @name         Google Cloud Shell - Quota Checker
// @namespace    https://github.com/madmaxmatze
// @version      1.2 (2023-01-15)
// @description  UserScript for tampermonkey.net chrome extension to check the remaining time within Google Cloud Shell Quota (50h/week) to avoid being locked
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
            alert("The Google Cloud Shell Quota Checker works better if you grant notification permissions. Please accept the following request");
            Notification.requestPermission().then((permission) => {});
        }
    }

    function checkTime() {
        var authuser = (new URLSearchParams(location.search)).get('authuser') || 0;
        fetch(`/devshell/quota?authuser=${authuser}`)
            .then(response => response.text())
            .then(textResult => JSON.parse(textResult.match(/(\[.+\])/g)).flat())
            .then(([remainingQuotaSeconds, _totalSeconds, resetTimestamp]) => handleRemainingHours(remainingQuotaSeconds / 3600, resetTimestamp));
    }

    function handleRemainingHours(remainingQuotaHours, resetTimestamp) {
        var message = `Cloud Quota checked\n- ${~~(remainingQuotaHours * 10) / 10} hours are remaining\n- Reset will happen on ${(new Date(resetTimestamp)).toLocaleString()}`;
        console.log(message);
        if (remainingQuotaHours < 3) {
            if (('Notification' in window) && Notification.permission == "granted") {
                new Notification('Quota about to exceed', { body: message, image: "https://www.gstatic.com/cloudssh/images/favicon-32-dc34aa1a696e06bb830614570e4abbfa.png" });
            }
            alert(message);
            // redirect is prevented by Cloud Shell
            // setTimeout(() => {window.location.assign("https://github.com/madmaxmatze/code/tree/main/shell")}, 60000 * 5/*min*/);
        }
    }
})();

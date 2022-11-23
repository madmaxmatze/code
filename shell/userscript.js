// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  loaded from github
// @author       You
// @match        https://shell.cloud.google.com/?show=ide%2Cterminal
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var counter = JSON.parse(localStorage.getItem('test'));
    if (!counter) {
        counter = 0;
    }

    counter++;
    localStorage.setItem('test', counter);
    console.log (counter);

    fetch('https://shell.cloud.google.com/devshell/quota?authuser=0').then(response => {
         // console.log(JSON.stringify(response) );
        // response.text().then(result => {return console.log(result);});
        response.text().then(result => {
            var [remainingSecs, totalSecs, endDate] = JSON.parse(result.split("\n")[1]).flat()
            console.log("remainingSecs", remainingSecs);
            console.log("totalSecs", totalSecs);
            console.log("endDate", endDate);

        });
    });

})();

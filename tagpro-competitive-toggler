// ==UserScript==
// @name         Tagpro Competitive Toggler
// @include      http://*.koalabeast.com:*
// @include      http://tangent.jukejuice.com:*
// @exclude      http://*.koalabeast.com:3000*
// @author       eigenvector, JBB
// @run-at       document-start
// @version      1.1
// ==/UserScript==

// you can't use marble spin with pokerchip spin

var toggles = {
    pokerchip: false,
    wholeball: false,
    marble: false,
    liveplayerposition: false,
    milli: false,
    teamstats: false,
    macros: false,
    remap: false,
    transparent: false,
    tiletint: false
};

// don't touch past here

if(toggles.pokerchip && toggles.marble){
    toggles.marble = false;
}

window.sessionStorage.toggles = JSON.stringify(toggles);

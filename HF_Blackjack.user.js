// ==UserScript==
// @name       HF BlackJack
// @author xadamxk
// @namespace  https://github.com/xadamxk/HF-Scripts
// @version    1.0.0
// @description Does its best to win HF BlackJack
// @require https://code.jquery.com/jquery-3.1.1.js
// @match      *://hackforums.net/blackjack.php
// @updateURL
// @downloadURL
// @iconURL https://raw.githubusercontent.com/xadamxk/HF-Blackjack/master/scripticon.jpg
// @copyright  2018+
// @grant   GM_xmlhttpRequest
// ==/UserScript==
// ------------------------------ Change Log ----------------------------
// version 1.0.1: Public Release
// version 1.0.0: Beta Release
// ------------------------------ Dev Notes -----------------------------
// Split logic does not exist yet!
// ------------------------------ SETTINGS ------------------------------
const wagerAmt = 2; // must be divisible by increment of 2, 10, 25, or 50
const confirmEachGame = true; // prompt for each new game (false for games2play)
const games2Play = 3; // how many games to play automatically
// ------------------------------- Script -------------------------------
/* ========== DO NOT CHANGE ANYTHING BELOW THIS LINE ========== */
/* Global Constants */
const myPostKey = document.getElementsByTagName('head')[0].innerHTML.split('my_post_key = "')[1].split('";')[0];
const bjAdvisorURL = "https://blackjackdoc.com/calculator/advisor.json.php";
const hfActionDealURL = "https://hackforums.net/blackjack/blackjack_action.php?action=deal";
const hfActionStandURL = "https://hackforums.net/blackjack/blackjack_action.php?action=stand";
const hfActionHitURL = "https://hackforums.net/blackjack/blackjack_action.php?action=hit";
const hfActionDoubleURL = "https://hackforums.net/blackjack/blackjack_action.php?action=double";
const hfActionSplitURL = "https://hackforums.net/blackjack/blackjack_action.php?action=split";
const hfActionSurrenderURL = "https://hackforums.net/blackjack/blackjack_action.php?action=surrender";
const dealHandBody = "bet="+wagerAmt+"&my_post_key="+myPostKey;
const numDecks = 4;
const hitSoft17 = 1;
const double = "all";
const doubleSoft = 0;
const doubleAfterHit = 0;
const doubleAfterSplit = 0;
const resplit = 1;
const lateSurrender = 1;
/* Global Variables */
var gamesPlayed = 0;
var dealResponse;
var gameID;
var actionID;
var origByteBalance;
var newByteBalance;

// Append stats
$('strong:contains("Risk your Bytes for a chance to win more!")').parent().parent()
    .after($("<tr>").append($("<td>").addClass("trow1").text("New:").append($("<div>").text("-").attr("id","newBytesTotal"))))
    .after($("<tr>").append($("<td>").addClass("trow1").text("Original:").append($("<div>").attr("id","originalBytesTotal"))));

// Update original bytes
initialOriginalBytes();

// Append start button
$('strong:contains("Risk your Bytes for a chance to win more!")')
    .after($("<button>").attr("id","startBJBot").text("Start Bot").addClass({}));

// Button click event
$( "#startBJBot" ).click(function() {
    ajaxPostRequest(hfActionDealURL, dealHandBody, true);
});

/* Functions */

function ajaxPostRequest(url, data, cont){
    setTimeout(function(){
        $.ajax({
            type: 'POST',
            url: url,
            data: data,
            async:false,
            success: function(data) {
                var jsonObj = jQuery.parseJSON(data);
                //console.log(jsonObj);
                if (jsonObj.balance){
                    updatenewBytes(jsonObj);
                }
                // HF Response
                if (jsonObj.balance && cont){
                    gameID = jsonObj.data.game_id;
                    actionID = jsonObj.data.action_id;
                    console.log("SINGLE GAME RESULT: "+getSingleGameResult(jsonObj));
                    if(getSingleGameResult(jsonObj) == "FOLD"
                       || getSingleGameResult(jsonObj) == "TIE"
                       || getSingleGameResult(jsonObj) == "WIN-BLACKJACK"){
                        startNextGame();
                    } else {
                        crossOriginPostRequest(bjAdvisorURL,generateRawData(data));
                    }
                } else {
                    // UNEXPECTED RESULT?
                    //console.log("Result: "+getSingleGameResult(jsonObj));
                    console.log("Result: "+getSingleGameResult(jsonObj) + " ("+getSingleGamePayout(jsonObj)+")");
                    startNextGame();
                }

            },
        });
    }, 500);
}

function startNextGame(){
    setTimeout(function(){
        if (confirmEachGame){
            if (confirm("Play Again?")){
                console.clear();
                ajaxPostRequest(hfActionDealURL, dealHandBody, true);
            }
        } else {
            if (gamesPlayed < games2Play){
                gamesPlayed++;
                console.clear();
                ajaxPostRequest(hfActionDealURL, dealHandBody, true);
            } else{
                alert("DONE RUNNING!");
            }
        }
    }, 1000);
}

function crossOriginPostRequest(url, data){
    //
    GM_xmlhttpRequest ( {
        method: "POST",
        data: data,
        synchronous: true,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*"
        },
        url: url,
        onload: function (response) {
            var jsonObj = jQuery.parseJSON(response.response);
            console.log("BEST OPTION: "+jsonObj.best);
            console.log(getActionOdds(jsonObj));
            // Desired Action - On HF
            if (jsonObj.best == "stand"){
                ajaxPostRequest(hfActionStandURL, generateHFRawData(), false);
            } else if (jsonObj.best == "hit"){
                ajaxPostRequest(hfActionHitURL, generateHFRawData(), true);
            } else if (jsonObj.best == "double"){
                ajaxPostRequest(hfActionDoubleURL, generateHFRawData(), true);
            } else if (jsonObj.best == "split"){
                // TODO: Additional Logic for actual split
                //ajaxPostRequest(hfActionSplitURL, generateHFRawData(), false);
                ajaxPostRequest(hfActionStandURL, generateHFRawData(), false);
            }else if (jsonObj.best == "surrender"){
                ajaxPostRequest(hfActionSurrenderURL, generateHFRawData(), false);
            }
        }
    } );
}

function initialOriginalBytes(){
    $("#originalBytesTotal").text($("#balanceCounterBalance").text());
    console.clear();
}

function updatenewBytes(jsonObj){
    $("#newBytesTotal").text(jsonObj.balance);
}

function getActionOdds(jsonObj){
    return jsonObj.a;
}

function getSingleGamePayout(jsonObj){
    return parseInt(jsonObj.data.payout)/wagerAmt;
}

function getSingleGameResult(jsonObj){
    return jsonObj.data.outcome1;
}

function getDealerHand(json){
    var jsonObj = jQuery.parseJSON(json);
    return jsonObj.data.dealer.hand_cards;
}

function getMyHand(json){
    var jsonObj = jQuery.parseJSON(json);
    return jsonObj.data.hand1.hand_cards;
}

function parseHand(array){
    var handString = "";
    for (var arrayIndex = 0; arrayIndex < array.length; arrayIndex++) {
        // Convert face cards to 10
        if (array[arrayIndex] !== "XX"){
            array[arrayIndex] = array[arrayIndex].replace(/\D/g,''); // Remove all letters from string
            if (array[arrayIndex] == "11" || array[arrayIndex] == "12" || array[arrayIndex] == "13"){
                array[arrayIndex] = "10";
            }
            handString += array[arrayIndex];
            // Card seperator
            if (jQuery.inArray( "XX",array) == 1){
                // If not last
                if (arrayIndex+2 < array.length){
                    handString += "%2C";
                }
            } else if (arrayIndex+1 < array.length) {
                handString += "%2C";
            }
        }
    }
    return handString;
}

function generateHFRawData(){
    return "gameId=" + gameID + "&actionId=" + actionID + "&my_post_key=" + myPostKey;
}

function generateRawData(json){
    var rawDataString = "dealerCard=" + parseHand(getDealerHand(json))
    + "&playerCards=" + parseHand(getMyHand(json))
    + "&numDecks=" + numDecks
    + "&hitSoft17=" + hitSoft17
    + "&double=" + double
    + "&doubleSoft=" + doubleSoft
    + "&doubleAfterHit=" + doubleAfterHit
    + "&doubleAfterSplit=" + doubleAfterSplit
    + "&resplit=" + resplit
    + "&lateSurrender=" + lateSurrender;

    return rawDataString;
}
// ==UserScript==
// @name          HF BlackJack
// @author        xadamxk
// @namespace     https://github.com/xadamxk/HF-Scripts
// @version       1.1.1
// @description   Improves your blackjack experience
// @require       https://code.jquery.com/jquery-3.1.1.js
// @match         *://hackforums.net/blackjack.php
// @connect       blackjackdoc.com/calculator/advisor.json.php
// @connect       blackjackdoc.com
// @updateURL     https://github.com/xadamxk/HF-Blackjack/raw/master/HF_Blackjack.user.js
// @downloadURL   https://github.com/xadamxk/HF-Blackjack/raw/master/HF_Blackjack.user.js
// @iconURL       https://github.com/xadamxk/HF-Blackjack/blob/master/scripticon.png?raw=true
// @copyright     2018+
// @grant         GM_xmlhttpRequest
// ==/UserScript==
// ------------------------------ Change Log ----------------------------
// version 1.1.1: Fixed throwing exceptions on Lose, Win, and Surrender
// version 1.1.0: Added card hand, probability, best option, and result to UI
// version 1.0.3: Added connect meta tag to mitigate CORS permissions
// version 1.0.2: Start confirmation, script disclaimer, start button margin
// version 1.0.1: Public Release (UpdateURL, DownloadURL, iconURL)
// version 1.0.0: Initial Release
// ------------------------------ Dev Notes -----------------------------
// Split logic does not exist yet!
// ------------------------------ SETTINGS ------------------------------
const wagerAmt = 2; // must be divisible by increment of 2, 10, 25, or 50
const confirmEachGame = true; // prompt for each new game (false for gamesPerSession)
const gamesPerSession = 3; // how many games to play automatically
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
    .after($("<tr>").append($("<td>").addClass("trow1").text("Original:").append($("<div>").attr("id","originalBytesTotal"))))
    .after($("<tr>")/*.append($("<td>")*/.css("color","red").text("HF Blackjack Userscript: USE AT YOUR OWN RISK!"));

// Update original bytes
initialOriginalBytes();

// Append start button
$('strong:contains("Risk your Bytes for a chance to win more!")')
    .after($("<button>").attr("id","startBJBot").text("Start Bot").css("margin-left","10px"));

// Button click event
$( "#startBJBot" ).click(function() {
    if (confirm("Are you sure you want to start the script?")){
        setWagerTotal();
        ajaxPostRequest(hfActionDealURL, dealHandBody, true);
    }
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
                       || getSingleGameResult(jsonObj) == "WIN-BLACKJACK"
                       || getSingleGameResult(jsonObj) == "WIN"
                       || getSingleGameResult(jsonObj) == "LOSE"
                       || getSingleGameResult(jsonObj) == "SURRENDER"){
                        setGameResult(getSingleGameResult(jsonObj));
                        startNextGame();
                    } else {
                        crossOriginPostRequest(bjAdvisorURL,generateRawData(data));
                    }
                } else {
                    // UNEXPECTED RESULT?
                    //console.log("Result: "+getSingleGameResult(jsonObj));
                    console.log("Result: "+getSingleGameResult(jsonObj) + " ("+getSingleGamePayout(jsonObj)+")");
                    setGameResult(getSingleGameResult(jsonObj));
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
            if (gamesPlayed < gamesPerSession){
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
            setHandResult(jsonObj.best);
            setOddsDisplay(getActionOdds(jsonObj));
            // Set hand total value
            $("#playerHand1").find(".cardsValueSign").attr("style","display:").text(jsonObj.sum.replace(/\D/g,''));
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
    var handArray = array;
    saveHand(handArray);
    var handString = "";
    for (var arrayIndex = 0; arrayIndex < array.length; arrayIndex++) {
        if (array[arrayIndex] !== "XX"){
            array[arrayIndex] = array[arrayIndex].replace(/\D/g,''); // Remove all letters from string
            // Convert face cards to 10
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

function saveHand(handArray){
    // Dealer Hand
    if (jQuery.inArray( "XX",handArray) == 1){
        setDealerHand(handArray);
    } else {
        setYourHand(handArray);
    }
}

function setYourHand(array){
    $("#playerHand1").find(".cardsContainer").empty();
    // Set hand - cards
    for (var i = 0; i < array.length; i++) {
        // Sets hand card
        $("#playerHand1").find(".cardsContainer").append(createCard(array[i], i));
    }
}

function setDealerHand(array){
    $("#dealerHand").find(".cardsContainer").empty();
    // Set hand - cards
    for (var i = 0; i < array.length; i++) {
        // Sets hand card
        $("#dealerHand").find(".cardsContainer").append(createCard(array[i], i));
    }
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

function setWagerTotal(){
    $("#playerHand1").find(".betValueSign").attr("style","display:").text(wagerAmt);
}

function setGameResult(result){
    $("#playerHand1").find(".handOutcomeSign").attr("style","display:").text(result);
}

function setHandResult(result){
    $("#playerHand1").find(".cardsOutcomeSign").attr("style","display:").text(result);
}

function setOddsDisplay(array){
    $("#rules > ul").empty();
    for (var key in array) {
        if (array.hasOwnProperty(key)) {
            $("#rules > ul").append($("<li>").text(key + ": " + array[key]));
        }
    }
}

function getCardSuit(card){
    return card.substr(card.length - 1);
}

function getCardValue(card){
    return card.substr(0, card.length - 1);
}

function createCard(card, index){
    var offset = calcOffset(card);
    return '<div class="card" style="background-position: ' + offset.x + 'px ' + offset.y +
        'px; display: block; text-indent: 0px; transform: rotateY(0deg); left: '+ (4+(13*index)) +'px" data-card="'+ card +'"></div>';
}

function calcOffset(card){
    var x = -949, y = 0; // Back of cards
    if (card != "back" && card != "XX") {
        var suits = { 'c': 0, 's': 1, 'h': 2, 'd': 3 }; // Order of the suits in the sprites file
        x = -(getCardValue(card) - 1) * 73;
        y = -suits[getCardSuit(card)] * 98 ;
    }
    return { x: x, y: y};
}
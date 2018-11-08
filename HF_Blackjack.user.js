// ==UserScript==
// @name          HF BlackJack
// @author        xadamxk
// @namespace     https://github.com/xadamxk/HF-Scripts
// @version       1.2.0
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
// version 1.2.0: Implemented BlackJack Stats & History tables
// version 1.1.2: Updated Your/Dealer's hand and totals when game is over
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
const dealHandBody = "bet=" + wagerAmt + "&my_post_key=" + myPostKey;
const numDecks = 4;
const hitSoft17 = 1;
const double = "all";
const doubleSoft = 0;
const doubleAfterHit = 0;
const doubleAfterSplit = 0;
const resplit = 1;
const lateSurrender = 1;
/* Global Variables */
var dealResponse;
var gameID;
var actionID;
var origByteBalance;
var currentBalance = Math.max(0, parseInt($("#balanceCounterBalance").text()));
var newByteBalance;
var HFBJ = localStorage.getItem('hf-bj');
console.clear();
initializeLogFromMemory(); // Init Log
// Current Game Stats
var isBotRunning = false;
var latestWinAmt = 0;// TODO: Get value from local storage
var sessionTotalGames = 0;
var sessionTotalBet = 0;
var sessionTotalWon = 0;
var sessionNet = 0;
var overallTotalGames = HFBJ.totalGames;
var overallTotalBet = HFBJ.totalBet;
var overallTotalWon = HFBJ.totalWon;
var overallTotalNet = HFBJ.totalWon - HFBJ.totalBet;



// Append warning
$('strong:contains("Risk your Bytes for a chance to win more!")').parent().parent()
    //.after($("<tr>").append($("<td>").addClass("trow1").text("New:").append($("<div>").text("-").attr("id", "newBytesTotal"))))
    //.after($("<tr>").append($("<td>").addClass("trow1").text("Original:").append($("<div>").attr("id", "originalBytesTotal"))))
    .after($("<tr>")/*.append($("<td>")*/.css("color", "red").text("HF Blackjack Userscript: USE AT YOUR OWN RISK!"));

// Update original bytes
initialStats();

// Toggle Bot click event
// TODO: Add logic for toggle
$("#toggleBJBot").click(function () {
    if (confirm("Are you sure you want to start the script?")) {
        setWagerTotal();
        ajaxPostRequest(hfActionDealURL, dealHandBody, true);
    }
});

$("#setBJBotMemory").click(function () {
    if (confirm("Are you sure you want to clear all log history?")) {
        localStorage.removeItem('hf-bj');
        clearStats();
    }
});

/* Functions */

function ajaxPostRequest(url, data, cont) {
    setTimeout(function () {
        $.ajax({
            type: 'POST',
            url: url,
            data: data,
            async: false,
            success: function (data) {
                var jsonObj = jQuery.parseJSON(data);
                if (jsonObj.balance) {
                    updatenewBytes(jsonObj);
                    // Update dealer's ahnd
                    setDealerHand(parseHFDealerHand(jsonObj));
                    // Update your hands
                    setYourHand(jsonObj.data.hand1.hand_cards);
                    // Update your hand total
                    updateYourHandTotal(jsonObj.data.hand1.hand_value);
                }
                // HF Response
                if (jsonObj.balance && cont) {
                    gameID = jsonObj.data.game_id;
                    actionID = jsonObj.data.action_id;
                    console.log("SINGLE GAME RESULT: " + getSingleGameResult(jsonObj));
                    if (getSingleGameResult(jsonObj) == "FOLD"
                        || getSingleGameResult(jsonObj) == "TIE"
                        || getSingleGameResult(jsonObj) == "WIN-BLACKJACK"
                        || getSingleGameResult(jsonObj) == "WIN"
                        || getSingleGameResult(jsonObj) == "LOSE"
                        || getSingleGameResult(jsonObj) == "SURRENDER") {
                        setGameResult(getSingleGameResult(jsonObj));

                        startNextGame();
                    } else {
                        crossOriginPostRequest(bjAdvisorURL, generateRawData(data));
                    }
                } else {
                    console.log("Result: " + getSingleGameResult(jsonObj) + " (" + getSingleGamePayout(jsonObj) + ")");
                    setGameResult(getSingleGameResult(jsonObj));

                    startNextGame();
                }

            },
        });
    }, 500);
}

function startNextGame() {
    setTimeout(function () {
        if (confirmEachGame) {
            if (confirm("Play Again?")) {
                console.clear();
                ajaxPostRequest(hfActionDealURL, dealHandBody, true);
            }
        } else {
            if (gamesPlayed < gamesPerSession) {
                gamesPlayed++;
                console.clear();
                ajaxPostRequest(hfActionDealURL, dealHandBody, true);
            } else {
                alert("DONE RUNNING!");
            }
        }
    }, 1000);
}

function crossOriginPostRequest(url, data) {
    //
    GM_xmlhttpRequest({
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
            console.log("BEST OPTION: " + jsonObj.best);
            setHandResult(jsonObj.best);
            setOddsDisplay(getActionOdds(jsonObj));
            // Set hand total value
            updateYourHandTotal(jsonObj.sum);
            // Desired Action - On HF
            if (jsonObj.best == "stand") {
                ajaxPostRequest(hfActionStandURL, generateHFRawData(), false);
            } else if (jsonObj.best == "hit") {
                ajaxPostRequest(hfActionHitURL, generateHFRawData(), true);
            } else if (jsonObj.best == "double") {
                ajaxPostRequest(hfActionDoubleURL, generateHFRawData(), true);
            } else if (jsonObj.best == "split") {
                // TODO: Additional Logic for actual split
                //ajaxPostRequest(hfActionSplitURL, generateHFRawData(), false);
                ajaxPostRequest(hfActionStandURL, generateHFRawData(), false);
            } else if (jsonObj.best == "surrender") {
                ajaxPostRequest(hfActionSurrenderURL, generateHFRawData(), false);
            }
        }
    });
}

function updateYourHandTotal(sum) {
    $("#playerHand1").find(".cardsValueSign").attr("style", "display:").text(sum.replace(/\D/g, ''));
}

function initialStats() {
    const buttonCSS = { "margin": "5px 5px" };
    const hrAttribute = { "width": "175px", "align": "left" };
    const centerCSS = { "display": "flex", "justify-content": "center" };
    const tableCSS = { "display": "inline-block", "width": "175px", "text-align": "left" };
    overallTotalNet = (HFBJ.totalWon - HFBJ.totalBet) + HFBJ.totalWon;

    $("#PageContainer").parent().css("width", "800px");
    $("#PageContainer").parent().after($("<td>").addClass("trow1")
        .append($("<div>").css("height", $("#PageContainerInner").css("height"))
            .append($("<div>").attr("id", "hfbjStatsContainer"))));
    $('td:contains("This blackjack table uses HF Bytes points which is our internal rewards system.")').attr("colspan", "2");

    $("#hfbjStatsContainer").append($("<span>").attr("id", "currentBalanceLabel").text("Credits: ").css(tableCSS))
        .append($("<span>").attr("id", "currentBalance").text(currentBalance)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "wagerAmtLabel").text("Wager Amount: ").css(tableCSS))
        .append($("<span>").attr("id", "wagerAmt").text(wagerAmt)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "latestWinAmtLabel").text("Latest Win: ").css(tableCSS))
        .append($("<span>").attr("id", "latestWinAmt").text(latestWinAmt)).append("<br>");
    // Session
    $("#hfbjStatsContainer").append($("<hr>").attr(hrAttribute));
    $("#hfbjStatsContainer").append($("<b>").attr("id", "sessionLabel").text("Session").css(tableCSS)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "sessionTotalGamesLabel").text("Games Played (Session): ").css(tableCSS))
        .append($("<span>").attr("id", "sessionTotalGames").text(sessionTotalGames)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "sessionTotalBetLabel").text("Total Bet (Session): ").css(tableCSS))
        .append($("<span>").attr("id", "sessionTotalBet").text(sessionTotalBet)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "sessionTotalWonLabel").text("Total Won (Session): ").css(tableCSS))
        .append($("<span>").attr("id", "sessionTotalWon").css("color", getAmountColor(sessionTotalWon)).text(sessionTotalWon)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "sessionNetLabel").text("Net Gain (Session): ").css(tableCSS))
        .append($("<span>").attr("id", "sessionNet").css("color", getAmountColor(sessionNet)).text(sessionNet)).append("<br>");
    // Overall
    $("#hfbjStatsContainer").append($("<hr>").attr(hrAttribute));
    $("#hfbjStatsContainer").append($("<b>").attr("id", "overallLabel").text("Overall").css(tableCSS)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "overallTotalGamesLabel").text("Games Played (Overall): ").css(tableCSS))
        .append($("<span>").attr("id", "overallTotalGames").text(overallTotalGames)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "overallTotalBetLabel").text("Total Bet (Overall): ").css(tableCSS))
        .append($("<span>").attr("id", "overallTotalBet").text(overallTotalBet)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "overallTotalWonLabel").text("Total Won (Overall): ").css(tableCSS))
        .append($("<span>").attr("id", "overallTotalWon").css("color", getAmountColor(overallTotalWon)).text(overallTotalWon)).append("<br>");
    $("#hfbjStatsContainer").append($("<span>").attr("id", "overallTotalNetLabel").text("Net Gain (Overall): ").css(tableCSS))
        .append($("<span>").attr("id", "overallTotalNet").css("color", getAmountColor(overallTotalNet)).text(overallTotalNet)).append("<br>");

    // Buttons
    $("#hfbjStatsContainer").append($("<div>").css({ "padding-left": "40px" }).append($("<button>").attr("id", "toggleBJBot").text("Start Bot").css(buttonCSS))
        .append($("<button>").attr("id", "setBJBotMemory").text("Reset Logs").css(buttonCSS)));
    $("#hfbjStatsContainer").append("<br><br>");

    // History log
    const tableAttributes = { "border": "0", "cellspacing": "0", "cellpadding": "5", "class": "tborder", "id": "historyTable" };
    const tbodyCSS = {
        "overflow-y": "auto",
        "overflow-x": "hidden !important", "display": "block", "height": "250px"
    };
    const trCSS = {};
    $("#hfbjStatsContainer").after($("<table>").attr(tableAttributes)
        .append($("<tbody>").attr("id", "historyTabletbody").css(tbodyCSS)
            .append($("<tr>").css(trCSS)
                .append($("<td>").addClass("thead").attr("colspan", "4")
                    .append($("<strong>").text("HF BlackJack Bot History"))))
            .append($("<tr>").css(trCSS)
                .append($("<td>").addClass("tcat").attr("colspan", "1")
                    .append($("<strong>").text("Result")))
                .append($("<td>").addClass("tcat").attr("colspan", "1")
                    .append($("<strong>").text("Date")))
                .append($("<td>").addClass("tcat").attr("colspan", "1")
                    .append($("<strong>").text("Wagered")))
                .append($("<td>").addClass("tcat").attr("colspan", "1")
                    .append($("<strong>").text("Received")))
            )
        )
    );
    updateHistoryTable();
}

function updateHistoryTable() {
    if (HFBJ.logs.length > 0) {
        const trCSS = {};
        const tdRightAlignAttribute = { "align": "right" };
        const dateFormat = {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        };
        $.each(HFBJ.logs.reverse(), function (index, value) {
            $("#historyTabletbody").append($("<tr>").css(trCSS)
                .append($("<td>").addClass("trow1").attr("colspan", "1")
                    .append($("<strong>").text(value.Result).css("color",getResultColor(value.Result))))
                .append($("<td>").addClass("trow1").attr("colspan", "1")
                    .append($("<strong>").text(new Date(value.Date).toLocaleTimeString([], dateFormat))))
                .append($("<td>").addClass("trow1").attr("colspan", "1").attr(tdRightAlignAttribute)
                    .append($("<strong>").text(value.AmountWagered)))
                .append($("<td>").addClass("trow1").attr("colspan", "1").attr(tdRightAlignAttribute)
                    .append($("<strong>").text(value.AmountWon).css("color", getAmountColor(value.AmountWon))))
            )
        });
    }
}

function clearStats() {
    latestWinAmt = 0;
    sessionTotalGames = 0;
    sessionTotalBet = 0;
    sessionTotalWon = 0;
    sessionNet = 0;
    overallTotalGames = 0;
    overallTotalBet = 0;
    overallTotalWon = 0;
    overallTotalNet = 0;
    updateStats(true);
}

function updateStats(clearValues) {
    if (!clearValues) {
        sessionNet = (sessionTotalWon - sessionTotalBet) + sessionTotalWon;
        overallTotalNet = (HFBJ.totalWon - HFBJ.totalBet) + HFBJ.totalWon;
    }
    // Update table
    $("#latestWinAmt").text(latestWinAmt);
    $("#sessionTotalGames").text(sessionTotalGames);
    $("#sessionTotalBet").text(sessionTotalBet);
    $("#sessionTotalWon").text(sessionTotalWon).css("color", getAmountColor(sessionTotalWon));
    $("#sessionNet").text(sessionNet).css("color", getAmountColor(sessionNet));
    $("#overallTotalGames").text(overallTotalGames);
    $("#overallTotalBet").text(overallTotalBet);
    $("#overallTotalWon").text(overallTotalWon).css("color", getAmountColor(overallTotalWon));
    $("#overallTotalNet").text(overallTotalNet).css("color", getAmountColor(overallTotalNet));
}

function getAmountColor(amount) {
    var color = "#C3C3C3";
    if (amount > 0) {
        color = "#00B500";
    } else if (amount < 0) {
        color = "#FF2121";
    }
    return color;
}

function getResultColor(result) {
    var color = "#C3C3C3";
    switch (result) {
        case "WIN": color = "#C5B358";
            break;
        case "WIN-BLACKJACK": color = "#C5B358";
            break;
        case "TIE": color = "#586ac5";
            break;
        case "FOLD": color = "#ff1919";
            break;
        case "LOSE": color = "#ff1919";
            break;
        case "SURRENDER": color = "#EEE9E9";
            break;
        default: color = "#949494";
    }
    return color;
}

function updatenewBytes(jsonObj) {
    $("#currentBalance").text(jsonObj.balance);
}

function getActionOdds(jsonObj) {
    return jsonObj.a;
}

function getSingleGamePayout(jsonObj) {
    return parseInt(jsonObj.data.payout) / wagerAmt;
}

function getSingleGameResult(jsonObj) {
    return jsonObj.data.outcome1;
}

function getDealerHand(json) {
    var jsonObj = jQuery.parseJSON(json);
    return jsonObj.data.dealer.hand_cards;
}

function getMyHand(json) {
    var jsonObj = jQuery.parseJSON(json);
    return jsonObj.data.hand1.hand_cards;
}

function parseHand(array) {
    var handArray = array;
    saveHand(handArray);
    var handString = "";
    for (var arrayIndex = 0; arrayIndex < array.length; arrayIndex++) {
        if (array[arrayIndex] !== "XX") {
            array[arrayIndex] = array[arrayIndex].replace(/\D/g, ''); // Remove all letters from string
            // Convert face cards to 10
            if (array[arrayIndex] == "11" || array[arrayIndex] == "12" || array[arrayIndex] == "13") {
                array[arrayIndex] = "10";
            }
            handString += array[arrayIndex];
            // Card seperator
            if (jQuery.inArray("XX", array) == 1) {
                // If not last
                if (arrayIndex + 2 < array.length) {
                    handString += "%2C";
                }
            } else if (arrayIndex + 1 < array.length) {
                handString += "%2C";
            }
        }
    }
    return handString;
}

function saveHand(handArray) {
    // Dealer Hand
    if (jQuery.inArray("XX", handArray) == 1) {
        setDealerHand(handArray);
    } else {
        setYourHand(handArray);
    }
}

function setYourHand(array) {
    $("#playerHand1").find(".cardsContainer").empty();
    // Set hand - cards
    for (var i = 0; i < array.length; i++) {
        // Sets hand card
        $("#playerHand1").find(".cardsContainer").append(createCard(array[i], i));
    }
}

function parseHFDealerHand(jsonObj) {
    setDealerHandTotal(jsonObj);
    var unparsedDealerHand = jsonObj.data.dealer.hand_cards;
    var handArray = [];
    Object.keys(unparsedDealerHand).forEach(function (key) {
        handArray[key] = unparsedDealerHand[key];
    });
    return handArray;
}

function setDealerHand(array) {
    $("#dealerHand").find(".cardsContainer").empty();
    // Set hand - cards
    for (var i = 0; i < array.length; i++) {
        // Sets hand card
        $("#dealerHand").find(".cardsContainer").append(createCard(array[i], i));
    }
}

function generateHFRawData() {
    return "gameId=" + gameID + "&actionId=" + actionID + "&my_post_key=" + myPostKey;
}

function generateRawData(json) {
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

function setDealerHandTotal(jsonObj) {
    $("#dealerHand").find(".cardsValueSign").attr("style", "display:").text(jsonObj.data.dealer.hand_value);
}

function setWagerTotal() {
    $("#playerHand1").find(".betValueSign").attr("style", "display:").text(wagerAmt);
}

function setGameResult(result) {
    $("#playerHand1").find(".handOutcomeSign").attr("style", "display:").text(result);
    var bytesGained;
    const winBlackJackMultiplier = 2.5;
    const winMultiplier = 1;
    const tieMultiplier = 0;
    const loseMultiplier = -1;
    const surrenderMultiplier = -.5;
    switch (result) {
        case "WIN-BLACKJACK":
            bytesGained = wagerAmt * winBlackJackMultiplier;
            break;
        case "WIN":
            bytesGained = wagerAmt * winMultiplier;
            break;
        case "TIE":
            bytesGained = wagerAmt * tieMultiplier;
            break;
        case "FOLD":
            bytesGained = wagerAmt * loseMultiplier;
            break;
        case "LOSE":
            bytesGained = wagerAmt * loseMultiplier;
            break;
        case "SURRENDER":
            bytesGained = wagerAmt * surrenderMultiplier;
            break;
        default:
            bytesGained = 0;
    }
    // Add log entry
    var dateTimeNow = new Date().getTime();
    var logEntry = { "Date": dateTimeNow, "Result": result, "AmountWon": bytesGained, "AmountWagered": wagerAmt };
    HFBJ.logs.push(logEntry);
    // Session
    latestWinAmt = bytesGained;
    sessionTotalGames++;
    sessionTotalBet += wagerAmt;
    if (bytesGained > 0) {
        sessionTotalWon += bytesGained;
    }
    sessionNet = (sessionTotalWon - sessionTotalBet) + sessionTotalWon;
    // Overall
    overallTotalGames++
    HFBJ.totalGames = overallTotalGames;
    overallTotalBet += wagerAmt
    HFBJ.totalBet = overallTotalBet;;

    if (bytesGained > 0) {
        overallTotalWon += bytesGained
        HFBJ.totalWon = overallTotalWon;
    }
    overallTotalNet = (HFBJ.totalWon - HFBJ.totalBet) + HFBJ.totalWon;
    localStorage.setItem('hf-bj', JSON.stringify(HFBJ));
    updateStats(false);
}

function setHandResult(result) {
    $("#playerHand1").find(".cardsOutcomeSign").attr("style", "display:").text(result);
}

function setOddsDisplay(array) {
    $("#rules > ul").empty();
    for (var key in array) {
        if (array.hasOwnProperty(key)) {
            $("#rules > ul").append($("<li>").text(key + ": " + array[key]));
        }
    }
}

function getCardSuit(card) {
    return card.substr(card.length - 1);
}

function getCardValue(card) {
    return card.substr(0, card.length - 1);
}

function createCard(card, index) {
    var offset = calcOffset(card);
    return '<div class="card" style="background-position: ' + offset.x + 'px ' + offset.y +
        'px; display: block; text-indent: 0px; transform: rotateY(0deg); left: ' + (4 + (13 * index)) + 'px" data-card="' + card + '"></div>';
}

function calcOffset(card) {
    var x = -949, y = 0; // Back of cards
    if (card != "back" && card != "XX") {
        var suits = { 'c': 0, 's': 1, 'h': 2, 'd': 3 }; // Order of the suits in the sprites file
        x = -(getCardValue(card) - 1) * 73;
        y = -suits[getCardSuit(card)] * 98;
    }
    return { x: x, y: y };
}

function initializeLogFromMemory() {
    if (HFBJ === null) {
        HFBJ = {
            totalGames: 0,
            totalBet: 0,
            totalWon: 0,
            logs: [],

        }
    } else {
        HFBJ = JSON.parse(HFBJ);
        console.log(HFBJ);
    }
}
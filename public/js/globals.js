// === ГЛОБАЛЬНІ ЗМІННІ ТА СТАН ГРИ (globals.js) ===

var currentUser = null; // Завантажується після DOMContentLoaded
var players = [];
var turn = 0;
var properties = {};
var jackpotAmount = 0;
var lastRollWasDouble = false;
var lastDiceSum = 0;
var isRolling = false;
var currentRound = 1;
var debtAlertShown = false;
var jackpotRate = 0.5;
var isOnlineMode = false;
var gameOver = false;

// Змінні Корупції (оголошені тут, щоб уникнути дублювання)
var kumActive = false;
var corruptionMode = null;

// Мережеві змінні
var socket = typeof io !== 'undefined' ? io() : null;
var myMultiplayerId = null;
var currentLobby = null;
var pendingTrade = null;

// Біржа
var stocks = {
    PTC: { price: 500, pool: 0, trend: 'up', noVisit: 0 },
    RTL: { price: 1000, pool: 0, trend: 'up', noVisit: 0 },
    TRN: { price: 1000, pool: 0, trend: 'up', noVisit: 0 },
    PST: { price: 1000, pool: 0, trend: 'up', noVisit: 0 },
    GOV: { price: 2000, pool: 0, totalMax: 50, issued: 0, trend: 'up' }
};

// Константи
const dotL = {
    1:[0,0,0,0,1,0,0,0,0], 2:[1,0,0,0,0,0,0,0,1], 3:[1,0,0,0,1,0,0,0,1],
    4:[1,0,1,0,0,0,1,0,1], 5:[1,0,1,0,1,0,1,0,1], 6:[1,0,1,1,0,1,1,0,1]
};
const playerColors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

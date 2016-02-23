// TypeDungeon by Andrew Barry

window.onload = loadGame;

// IMPORTANT GRAPHICS VARIABLES
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
var hudCamera = new THREE.OrthographicCamera(125 / -2, 125 / 2, 125 / 2, 125 / -2, 1, 10);
var hud = new THREE.Scene();
var loader = new THREE.OBJMTLLoader();
var renderer = new THREE.WebGLRenderer();
var sock = new WebSocket("ws://type.dungeon.online/ws");
var domEvents = new THREEx.DomEvents(camera, renderer.domElement);
var charactersPerLine = Math.floor(800 / 16);


// PLAYERS INFO
var players = [];
var playerIndeces = [];
var playerIDs = {};
var yourPlayer;
var room_id;

// THINGS BEING DRAWN
var objectsToDraw = [];
var spritesToDraw = [];
var dynamicTextures = [];
var textures = {};
var objects = {};

// INPUT & MOVEMENT
var keys = [];
var direction = 0;
var turning = false;
var walking = false;
var rotateTo;
var walkingCounter = 0;
var stepQueue;
var inControl = false;
var startPos;
var solidSpaces = [];

// ENCOUNTER VARIABLES
var inEncounter = false;
var enemySprite;
var enemyWPM;
var enemyHP;
var oEHP;
var oPHP = 150;
var typeText = [];
var typeSrc;
var typeCursor = 0;
var typeLineCursor = 0;
var tlcReset = -1;
var lineOnScreen = 0;
var currentLineText;
var playerHP;
var barctx;
var correctCharacters = 0;
var encounterStartTime;
var elapsedTime = 0;
var lineTime = 0;
var lineWords = 0;
var didTypo = false;


// MISC VARIABLES
var gameState = 0; // 0 - main menu, 1 - lobby, 3 - loading/syncing screen, 4 - playing, 5 - encounter
var currentMap = [];
var xPos = -1;
var yPos = -1;
var exitX = -1;
var exitY = -1;
var loadSpaceX = 0;
var loadSpaceY = 0;
var numTotalWalls = 0;
var numWalls = 0;
var numTotalMapLines = 0;
var numTotalWalls = 0;
var numObjects = 0;
var numTotalObjects = 0;
var bufferedMap = [];

// GLOBALLY USEFUL ASSETS
var buttonGeometry = new THREE.BoxGeometry(10,5,0);
var hugeButtonGeometry = new THREE.BoxGeometry(50,50,0);
var colors = ['green','red','cyan','yellow'];
var shadMat = new THREE.ShaderMaterial({
    uniforms: { cPos: { type: 'v3', value: camera.position}},
    vertexShader: $('#vertshader').text(),
    fragmentShader: $('#fragshader').text()
});

// store some info on each player
var Player = Class.extend({
    init: function(id, name) {
	this.id = id;
	this.name = name;
	this.wpm = 0;
	var playerMaterial;
	switch (players.length) {
	    case 0: { playerMaterial = new THREE.MeshBasicMaterial({color:0x00ff00}); break; }
	    case 1: { playerMaterial = new THREE.MeshBasicMaterial({color:0xff0000}); break; }
	    case 2: { playerMaterial = new THREE.MeshBasicMaterial({color:0x0000ff}); break; }
	    case 3: { playerMaterial = new THREE.MeshBasicMaterial({color:0xffffff}); break; }
	    default: { playerMaterial = new THREE.MeshBasicMaterial({color:0x000000}); break; }
	}
    }
});

// simple queue for input
var Queue = Class.extend({
    init: function() {
	this.l = [];
    },
    enqueue: function(i) {
	this.l[this.l.length] = i;
    },
    dequeue: function() {
	if (this.l.length == 0) {
	    return null;
	}
	return this.l.shift();
    },
    length: function() {
	return this.l.length;
    }
});
    

function loadGame() {
    sock.onmessage = onMessage;
    renderer.setSize(500,500);
    renderer.setSize(250,250,false);
    renderer.autoClear = false;
    hudCamera.position.z = 10;
    renderer.domElement.className += " mainDisplay";
    document.body.appendChild(renderer.domElement);
    $('#loadText').hide();
    $('#lobby').hide();
    $('#hpBars').hide();
    barctx = document.getElementById("hpBars").getContext("2d");
    $('#l0').text("TYPEDUNGEON");
    $('#l1').text("A work in progress");
    window.setTimeout(function() {
	if ($('#l1').text() == 'by Andrew Barry') {
	    $('#typeText').fadeOut(2000);
	}
    }, 3000);
    var searchCheck = location.search;
    if (searchCheck.split("=").length == 1) {
	loadState(0);
    }
    stepQueue = new Queue();
    $(document).on('keydown', function(k) {
	keys[k.keyCode] = true;
    });
    $(document).on('keyup', function(k) {
	keys[k.keyCode] = false;
    });
}

function newRoomButton() {
    dynamicTextures[0].clear('green');
    dynamicTextures[0].drawText("New Room", undefined, 32, 'white');
    domEvents.addEventListener(objectsToDraw[0], 'click', function(event) { sock.send("newr"); players[0] = yourPlayer;}, false);
}

function loadState(stateNumber) {
    if (stateNumber != 4 && stateNumber != 5){ // DO NOT delete 3D objects if moving load>game, game>encounter, encounter>game
	for (var x = 0; x < objectsToDraw.length; x++) {
	    if (objectsToDraw[x] != null) {
		scene.remove(objectsToDraw[x]);
	    }
	}
	objectsToDraw = [];
	dynamicTextures = [];
    }
    for (var x = 0; x < spritesToDraw.length; x++) {
	hud.remove(spritesToDraw[x]);
    }
    spritesToDraw = [];
    gameState = stateNumber;
    if (gameState == 0) { // main menu
	dynamicTextures[0] = new THREEx.DynamicTexture(64,64);
	if (sock.readyState == 0) {
	    dynamicTextures[0].clear('red');
	    dynamicTextures[0].drawText("Connecting", undefined, 32, 'white');
	    sock.onopen = newRoomButton;
	}
	else {
	    dynamicTextures[0].clear('green');
	    dynamicTextures[0].drawText("New Room", undefined, 32, 'white');
	}
	var startButtonMaterial = new THREE.MeshBasicMaterial({map:dynamicTextures[0].texture});
	objectsToDraw[objectsToDraw.length] = new THREE.Mesh(buttonGeometry, startButtonMaterial);
	objectsToDraw[0].position.z = -10;
	if (sock.readyState == 1) {
	    domEvents.addEventListener(objectsToDraw[0], 'click', function(event) { sock.send("newr"); players[0] = yourPlayer;}, false);
	}
	scene.add(objectsToDraw[0]);
    }
    else if (gameState == 1) { // lobby
	$('#lobby').show();
	for (var x = 0; x < 4; x++) {
	    dynamicTextures[x] = new THREEx.DynamicTexture(64,64);
	    dynamicTextures[x].clear(colors[x]);
	}
	for (var x = 0; x < 4; x++) {
	    if (x < players.length && players[x] != undefined && players[x].name != undefined) {
		$('#lobby'+x).text(players[x].name);
	    }
	    else {
		$('#lobby'+x).text("Waiting...");
	    }
	}
	dynamicTextures[4] = new THREEx.DynamicTexture(512,512);
	dynamicTextures[4].clear('black');
	dynamicTextures[4].drawText("Share the link in your location bar with friends.", undefined, 256, 'white');
	dynamicTextures[4].drawText("Click here when you're ready to start.", undefined, 300, 'white');
	var readyMat = new THREE.MeshBasicMaterial({map:dynamicTextures[4].texture});
	objectsToDraw[4] = new THREE.Mesh(hugeButtonGeometry, readyMat);
	objectsToDraw[4].position.set(0,0,-11);
	$('canvas').on('click', function() {
	    sock.send("ready");
	    $('canvas').on('click', function() {});
	    dynamicTextures[4].clear('black');
	    dynamicTextures[4].drawText("Waiting for all players to be ready...", undefined, 256, 'white');
	});
	scene.add(objectsToDraw[4]);
	window.history.replaceState('Object','Title','/?room=' + room_id);

    }
    else if (gameState == 3) { // loading next map
	currentMap = [];
	xPos = -1;
	yPos = -1;
	exitX = -1;
	exitY = -1;
	loadSpaceX = 0;
	loadSpaceY = 0;
	numTotalWalls = 0;
	numTotalMapLines = 0;
	numMapLines = 0;
	numWalls = 0;
	bufferedMap = [];
	playerHP = 150;
	currentMap = [];
	$('#loadText').fadeIn(400, function() { window.setTimeout(function() { sock.send("prepm"); }, 600); });
	var loadingDT = new THREEx.DynamicTexture(75,75);
	loadingDT.clear('black');
	var loadingMat = new THREE.SpriteMaterial({map: loadingDT.texture});
	var loadingSp = new THREE.Sprite(loadingMat);
	spritesToDraw[0] = loadingSp;
	var sW = loadingMat.map.image.width;
	var sH = loadingMat.map.image.height;
	loadingSp.scale.set(sW,sH,1);
	hud.add(loadingSp);
	loadingSp.position.set(0,0,1);
    }
    else if (gameState == 5) { // loading encounter
	inEncounter = true;
	var spPos;
	switch (playerIndeces.length) {
	    case 1: { spPos = [0]; break; }
	    case 2: { spPos = [-1 * window.innerWidth / 3, window.innerWidth / 3]; break; }
	    case 3: { spPos = [-1 * window.innerWidth / 4, 0, window.innerWidth / 4]; break; }
	    case 4: { spPos = [-2 * window.innerWidth / 5, -1 * window.innerWidth / 5, 
			       window.innerWidth / 5, 2 * window.innerWidth / 5]; break; }
	    default: { spPos = []; break; }
	}
	$('#typeText').show();
	enemySprite.minFilter = THREE.NearestFilter;
	enemySprite.magFilter = THREE.NearestFilter;
	var eMat = new THREE.SpriteMaterial({map: enemySprite});
	var eSp = new THREE.Sprite(eMat);
	eSp.scale.set(eMat.map.image.width, eMat.map.image.height, 1);
	eSp.position.set(0,0,1);
	spritesToDraw[spritesToDraw.length] = eSp;
	hud.add(eSp);
	updateHPBars();
	$('#hpBars').show();
    }
    else if (stateNumber == 4) { // entering new floor or exiting fight
	inEncounter = false;
	$('#typeText').hide();
	$('#hpBars').hide();
    }

}



// Server message handles for gameState == 0/1 (start screen, lobby)
function onMessage(m) {
    var message = (m.data + "").trim();
    if (gameState == 3) {
	loadingOnMessage(message);
    }
    else if (gameState == 4) {
	playingOnMessage(message);
    }
    else if (gameState == 5) {
	encounterOnMessage(message);
    }
    else if (message.startsWith("start")) { // game is ready - request first map and prepare to draw and receive maps
	for (var x = 0; x < 4; x++) {
	    if (players[x] != undefined) {
		playerIndeces[playerIndeces.length] = x;
		playerIDs[players[x].id] = x;
		$('#lobby'+x).text(players[x].name + " - " + players[x].wpm + "wpm");
	    }
	    else {
		$('#lobby'+x).text('');
	    }
	}
	bufferedMap = [];
	solidSpaces = [];
	loadState(3);
    }
    else if (message.startsWith("you,")) { // letting you know your credentials
	var my_info = message.split(",");
	var my_id = my_info[1];
	var yourName = prompt("What is your name?");
	if (yourName == '' || yourName == null) yourName = "Anonymous Typist";
	sock.send("name," + yourName);
	yourPlayer = new Player(my_id,yourName);
	var searchCheck = location.search;
	if (searchCheck.split("=").length != 1) {
	    var url_info = searchCheck.split("=");
	    if (url_info[0] == "?room") {
		room_id = url_info[1];
		sock.send("jroom," + room_id);
	    }
	}
    }
    else if (message.startsWith("newp,")) { // feeding you player info when you join a room
	var nminfo = message.split(",");
	if (nminfo == "newp,") {
	    players[players.length] = undefined;
	}
	else {
	    var nm_id = parseInt(nminfo[1]);
	    var nm_name = nminfo[2];
	    players[players.length] = new Player(nm_id, nm_name);
	}
    }
    else if (message.startsWith("full")) { // room you tried to join is full
	alert("That room is already full! Sorry.");
	loadState(0);
    }
    else if (message.startsWith("dnp")) { // end of new player transmission - join room now
	for (var x = 0; x < 4; x++) {
	    if (players[x] == undefined || players[x].name == undefined) {
		players[x] = yourPlayer;
		break;
	    }
	}
	loadState(1);
    }
    else if (message.startsWith("newr,")) { // new room created - here's the id
	room_id = message.split(",")[1];
	loadState(1);
    }
    else if (message.startsWith("join")) { // player is joining your room
	var j_info = message.split(",");
	var j_uid = parseInt(j_info[1]);
	var j_name = j_info[2];
	for (var x = 0; x < 4; x++) {
	    if (players[x] == undefined || players[x].name == undefined) {
		players[x] = new Player(j_uid, j_name);
		$('#lobby'+x).text(players[x].name);
		break;
	    }
	}
    }
    else if (message == 'noroom') {
	alert("Room not found. Create your own!");
	loadState(0);
    }

    if (message.startsWith("quit,")) { // player quit the room
	var qid = parseInt(message.split(",")[1]);
	for (var x = 0; x < 4; x++) {
	    if (players[x] != undefined && players[x].id == qid) {
		players[x] = undefined;
		if (gameState == 1) {
		    $('#lobby'+x).text('Waiting...');
		}
		else if (gameState > 1) {
		    updateWPMs();
		}
	    }
	}
    }
    
}

// onMessage for loading maps
function loadingOnMessage(message) {
    if (message == 'sync0' || message == 'sync3' || message == 'revoke') { // ignore useless messages
	return;
    }
    else if (message.startsWith("S")) {
	startPos = message.split(",");
	xPos = parseInt(startPos[1]);
	yPos = parseInt(startPos[2]);
	camera.position.set(xPos,0,yPos);
    }
    else if (message.startsWith("F")) {
	var fLocInfo = message.split(",");
	exitX = parseInt(fLocInfo[1]);
	exitY = parseInt(fLocInfo[2]);
	var exG = new THREE.BoxGeometry(.3,.3,.3);
	THREE.ImageUtils.loadTexture("assets/exit.png", undefined, function(t) {
	    t.minFilter = THREE.NearestFilter;
	    t.magFilter = THREE.NearestFilter;
	    var exM = new THREE.MeshBasicMaterial({ map: t });
	    exC = new THREE.Mesh(exG, exM);
	    exC.position.set(exitX, 0, exitY);
	    objectsToDraw.push(exC);
	    scene.add(exC);
	}, null);
    }
    else if (message.startsWith("WN")) { // number of wall paths
	numTotalWalls = parseInt(message.split(',')[1]);
	numWalls = 0;
	if (numTotalMapLines != 0 && numTotalObjects != -1) {
	    sock.send('sync0');
	}
    }
    else if (message.startsWith("MN")) { // number of lines to receive for the map
	numTotalMapLines = parseInt(message.split(',')[1]);
	numMapLines = 0;
	if (numTotalWalls != 0 && numTotalObjects != -1) {
	    sock.send('sync0');
	}
    }
    else if (message.startsWith("ON")) { // number of objects
	numTotalObjects = parseInt(message.split(',')[1]);
	numObjects = 0;
	if (numTotalWalls != 0 && numTotalMapLines != 0) {
	    sock.send('sync0');
	}
    }
    else if (message.startsWith("WP")) { // wall path
	var token = message.split(',')[1];
	var path = message.split(',')[2];
	THREE.ImageUtils.loadTexture('assets/' + path + "-wall.png", undefined, function(t) {
	    t.minFilter = THREE.NearestFilter;
	    t.magFilter = THREE.NearestFilter;
	    textures[token] = t;
	    numWalls++;
	    if (numMapLines == numTotalMapLines && numWalls == numTotalWalls && numObjects == numTotalObjects) {
		createMap();
	    }
	}, null);
	textures[token] = path;
    }
    else if (message.startsWith("OP")) { // object path
	var token = message.split(',')[1];
	var path = message.split(',')[2];
	loader.load("assets/models/" + path + ".obj",
				"assets/models/" + path + ".mtl",
				function(o) {
				    objects[token] = o;
				    numObjects++;
				    console.log(numObjects + " " + numTotalObjects);
				    if (numMapLines == numTotalMapLines && numWalls == numTotalWalls && numObjects == numTotalObjects) {
					createMap();
				    }
				}, function() {}, function() {});
    }
    else {
	bufferedMap[bufferedMap.length] = message;
	numMapLines++;
	if (numMapLines == numTotalMapLines && numWalls == numTotalWalls && numObjects == numTotalObjects) {
	    createMap();
	}
    }
}
function createMap() {
    loadSpaceX = 0;
    loadSpaceY = 0;
    var floorGeom = new THREE.BoxGeometry(1,0,1);
    var wallGeomHoriz = new THREE.BoxGeometry(0.001,1,1); // slight thickness for no ceiling clipping
    var wallGeomVert = new THREE.BoxGeometry(1,1,0.001);
    for (var b = 0; b < bufferedMap.length; b++) {
	var bMap = bufferedMap[b];
	var oi = objectsToDraw.length;
	var spaces = bMap.split(",");
	currentMap[currentMap.length] = spaces;
	for (var x = 0; x < spaces.length; x++) {
	    var items_at_space = spaces[x];
	    var amnt = 2;
	    for (var i = 0; i < items_at_space.length; i+= amnt) {
		amnt = 2;
		var item = items_at_space.charAt(i);
		if (item == 'f') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(floorGeom, mat);
		    objectsToDraw[oi].position.set(loadSpaceX, -.5, loadSpaceY);
		}
		else if (item == 'c') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(floorGeom, mat);
		    objectsToDraw[oi].position.set(loadSpaceX, .5, loadSpaceY);
		}
		else if (item == 'd') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(wallGeomHoriz, mat);
		    objectsToDraw[oi].position.set(loadSpaceX + 0.5, 0, loadSpaceY);
		}
		else if (item == 'a') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(wallGeomHoriz, mat);
		    objectsToDraw[oi].position.set(loadSpaceX - 0.5, 0, loadSpaceY);
		}
		else if (item == 's') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(wallGeomVert, mat);
		    objectsToDraw[oi].position.set(loadSpaceX, 0, loadSpaceY + 0.5);
		}
		else if (item == 'w') {
		    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
		    objectsToDraw[oi] = new THREE.Mesh(wallGeomVert, mat);
		    objectsToDraw[oi].position.set(loadSpaceX, 0, loadSpaceY - 0.5);
		}
		else if (item == 'o') {
		    console.log(items_at_space.charAt(i+1));
		    var objmtl = objects[items_at_space.charAt(i+1)].clone();
		    var solid = parseInt(items_at_space.charAt(i+2));
		    console.log(items_at_space.charAt(i+2) + ", " + solid);
		    objectsToDraw[oi] = objmtl;
		    objectsToDraw[oi].position.set(loadSpaceX, 0, loadSpaceY);
		    amnt = 3;
		    if (solid == 1) {
			solidSpaces.push([loadSpaceX, loadSpaceY]);
		    }
		}
		if ('wasdfco'.indexOf(item) != -1) {
		    scene.add(objectsToDraw[oi++]);
		}
	    }
	    loadSpaceY++;
	}
	loadSpaceX++;
	loadSpaceY = 0;
    } // end of final for
    typeSrc = "";
    typeCursor = 0;
    $('#loadText').hide();
    console.log("done loading map");
    loadState(4);
    sock.send('sync3');
}

// onMessage for gameplay
function playingOnMessage(message) {
    if (message == 'mf') {
	if (walking || turning) {
	    stepQueue.enqueue('mf');
	}
	else {
	    triggerMovement('mf');
	}
    }
    else if (message == 'mb') {
	if (walking || turning) {
	    stepQueue.enqueue('mb');
	}
	else {
	    triggerMovement('mb');
	}
    }
    else if (message == 'mtl') {
	if (walking || turning) {
	    stepQueue.enqueue('mtl');
	}
	else {
	    triggerMovement('mtl');
	}
    }
    else if (message == 'mtr') {
	if (walking || turning) {
	    stepQueue.enqueue('mtr');
	}
	else {
	    triggerMovement('mtr');
	}
    }
    
    else if (message.startsWith("q,")) { // qte letter
	$('#typeText').stop();
	$('#l1').text('');
	$('#l0').text("FOR CONTROL: " + message.split(",")[1].toUpperCase());
	$('#typeText').fadeTo(0,1);
	Mousetrap.setQTE(message.split(",")[1]);
    }
    else if (message.startsWith("grant")) {
	var g_uid = message.split(',')[1];
	if (g_uid == yourPlayer.id) {
	    inControl = true;
	}
	$('#typeText').stop();
	$('#l0').text(players[playerIDs[parseInt(g_uid)]].name + " has control!");
	$('#l1').text('');
	$('#typeText').fadeTo(0,1);
	window.setTimeout(function() { if ($('#l0').text().endsWith(" has control!")) { $('#typeText').hide(); }}, 2500);
    }
    else if (message == 'revoke') {
	    inControl = false;
    }
    
    // sync functions
    else if (message == 'sync1') {
	if (walking || turning) {
	    stepQueue.enqueue('sync1');
	}
	else {
	    sock.send('sync1');
	}
    }
    else if (message == 'sync3') {
	sock.send('sync3');
    }

    else if (message.startsWith('esp')) {
	THREE.ImageUtils.loadTexture('assets/' + message.split(':')[1], undefined, function(esp) {
	    enemySprite = esp;
	    typeLineCursor = 0;
	    flashColor("yellow", 100, 3, startEncounter);
	}, null);
    }
    else if (message.startsWith('ewpm:')) {
	enemyWPM = parseInt(message.split(':')[1]);
    }
    else if (message.startsWith('ehp:')) {
	enemyHP = parseInt(message.split(':')[1]);
	oEHP = enemyHP;
    }
    else if (message == 'enc') {
	loadState(5);
    }    
}
function startEncounter() {
    $.ajax({url:'text/get.py', method:'POST', data: {"l":charactersPerLine, "n":typeLineCursor}, success: function(r) {
	var tt = r.split("\n");
	console.log(tt);
	typeSrc = tt[0];
	typeText = [];
	typeCursor = 0;
	tlcReset = -1;
	lineWords = 0;
	playerHP = oPHP;
	lineOnScreen = 0;
	lineTime = Date.now();
	correctCharacters = 0;
	encounterStartTime = Date.now();
	window.setTimeout(calculateWPM,2000);
	for (var x = 1; x < 11; x++) {
	    typeText[x-1] = tt[x].trim();
	}
	$('#l0').html(typeText[0]);
	$('#l1').html(typeText[1]);
	$('#'+typeLineCursor+'c0').css('color','yellow');
	$('#'+typeLineCursor+'c0').css('text-decoration','underline');
	Mousetrap.bind($('#l0').text()[typeCursor], encounterHandleInput);
	currentLineText = $('#l0').text();
	sock.send('sync2');
    }});
}

function calculateWPM() {
    if (!inEncounter) return;
    elapsedTime = (Date.now() - encounterStartTime)/1000;
    yourPlayer.wpm = Math.floor((30 * correctCharacters) / 6); /* / elapsedTime); */
    sock.send("w," + yourPlayer.wpm);
    correctCharacters = 0;
    if (inEncounter) {
	window.setTimeout(calculateWPM,2000);
    }
    updateWPMs();
}

function encounterOnMessage(message) {
    if (message.startsWith("w")) { // wpm report from player
	var wId = message.split(",")[1];
	var wWPM = parseInt(message.split(",")[2]);
	players[playerIDs[wId]].wpm = wWPM;
    }
    else if (message.startsWith("a")) { // enemy takes damage
	enemyHP -= parseInt(message.split(",")[1]);
	if (enemyHP <= 0) { // you win
	    flashColor("green", 100, 3, function() {});
	    loadState(4);
	    sock.send("sync3");
	}
	else {
	    updateHPBars();
	}
    }
    else if (message.startsWith("d")) { // player takes damage
	playerHP -= parseInt(message.split(",")[1]);
	if (playerHP <= 0) { // you died
	    updateHPBars();
	    flashColor("red", 100, 3, doKill);
	}
	else {
	    updateHPBars();
	}
    }

    // deathsync
    else if (message == 'kill') {
	console.log("respawning");
	xPos = parseInt(startPos[1]);
	yPos = parseInt(startPos[2]);
	camera.position.set(xPos,0,yPos);
	loadState(4);
	playerHP = oPHP;
	sock.send("sync3");
    }

}

function updateHPBars() {
    barctx.fillStyle = 'black';
    barctx.fillRect(0,0,250,375);
    barctx.fillStyle = 'white';

    var pixelTickRed = (oEHP / 300);
    var pixelsOfRed = parseInt(enemyHP / pixelTickRed);
    barctx.fillStyle = 'red';
    barctx.fillRect(5, 370-pixelsOfRed, 50, pixelsOfRed);
    
    var pixelTickBlue = (oPHP / 300);
    var pixelsOfBlue = parseInt(playerHP / pixelTickBlue);
    barctx.fillStyle = 'blue';
    barctx.fillRect(65, 370-pixelsOfBlue, 50, pixelsOfBlue);
}

function updateWPMs() {
    for (var x = 0; x < 4; x++) {
	if (players[x] != null) {
	    $('#lobby'+x).text(players[x].name + " - " + players[x].wpm + "wpm");
	}
	else {
	    $('#lobby'+x).text('');
	}
    }
}

function doKill() {
    $('#l0').text("TYPING POWER INADEQUATE - YOU ARE DEAD!")
    $('#l1').text("(press 'r' to respawn.)");
    Mousetrap.bind('r', function() {
	Mousetrap.reset();
	$('#l1').text("waiting for all players...");
	sock.send("sync4");
    });
}

function cycleLines() {
    typeCursor = 0;
    tlcReset--;
    if (tlcReset == 0) typeLineCursor = 0;

    if (lineOnScreen == 0) { // finished writing first line
	$('#l0').html(typeText[typeLineCursor+2]);
	lineOnScreen++;
	currentLineText = $('#l1').text();
    }
    else { // finished writing second line - update & send Pair WPM
	$('#l1').html(typeText[typeLineCursor+2]);
	currentLineText = $('#l1').text();
	lineOnScreen = 0;
    }
    var lineTotalTime = Date.now() - lineTime;
    var lineWPM = parseInt(Math.floor((60 * lineWords) / (lineTotalTime / 1000)));
    console.log("Line wpm: " + lineWPM);
    sock.send('p,' + lineWPM);
    lineTime = Date.now();
    lineWords = 0;
    typeLineCursor++;
    if (typeLineCursor + 3 == typeText.length) { // getting close to the end of our text - fetch more
	$.ajax({url:'text/get.py', method:'POST', data: {"src": typeSrc, "l":charactersPerLine, "n":typeLineCursor+3}, success: function(r) {
	    var nwords = r.split("\n");
	    if (nwords[0] != typeSrc) {
		typeSrc = nwords[0];
		tlcReset = 4;
	    }
	    for (var x = 1; x < nwords.length; x++) {
		typeText.push(nwords[x]);
	    }
	}});
    }
}

function flashColor(color, colorDuration, times, completion) {
    flashInner(color, colorDuration, 0, times-1, completion);
}
function flashInner(color, colorDuration, x, total, completion) {
    $('body').animate(
	{ backgroundColor: color },
	colorDuration,
	function() {
	    $('body').animate(
		{ backgroundColor: "white" },
		colorDuration,
		function() {
		    if (x < total) {
			flashInner(color, colorDuration, ++x, total, completion);
		    }
		    else {
			completion();
		    }
		}
	    );
	}
    );
}

function render() {
    requestAnimationFrame(render);
    if (!inEncounter) {
	handleInput();
	update();
    }

    if (gameState != 3) { // do not draw the map while it is being created
	renderer.render(scene, camera);
	renderer.clearDepth();
    }
    
    renderer.render(hud, hudCamera);
}

function checkNewPosition() {
    if (xPos == exitX && yPos == exitY) { // exit!
	loadState(3);
	return true;
    }
    return false;
}

function containsArray(l, k) {
    if (l.length == 0) return false;
    for (var x = 0; x < l.length; x++) {
	if (l[x].length != k.length) continue;
	var b = true;
	for (var y = 0; y < l[x].length; y++) 
	    if (l[x][y] != k[y]) { b = false; break; }
	if (b) return true;
    }
    return false;
}

function legalMove(direc,forward) {
    var currentSpaceItems = currentMap[xPos][yPos];
    if (direc == 0) {
	if (forward) {
	    if (containsArray(solidSpaces, [xPos, yPos-1])) return false;
	    var nextSpaceItems = currentMap[xPos][yPos-1];
	    return (currentSpaceItems.indexOf("w") == -1 && nextSpaceItems.indexOf("s") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    if (containsArray(solidSpaces, [xPos, yPos+1])) return false;
	    var lastSpaceItems = currentMap[xPos][yPos+1];
	    return (currentSpaceItems.indexOf("s") == -1 && lastSpaceItems.indexOf("w") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 1) {
	if (forward) {
	    if (containsArray(solidSpaces, [xPos+1, yPos])) return false;
	    var nextSpaceItems = currentMap[xPos+1][yPos];
	    return (currentSpaceItems.indexOf("d") == -1 && nextSpaceItems.indexOf("a") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    if (containsArray(solidSpaces, [xPos-1, yPos])) return false;
	    var lastSpaceItems = currentMap[xPos-1][yPos];
	    return (currentSpaceItems.indexOf("a") == -1 && lastSpaceItems.indexOf("d") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 2) {
	if (forward) {
	    if (containsArray(solidSpaces, [xPos, yPos+1])) return false;
	    var nextSpaceItems = currentMap[xPos][yPos+1];
	    return (currentSpaceItems.indexOf("s") == -1 && nextSpaceItems.indexOf("w") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    if (containsArray(solidSpaces, [xPos, yPos-1])) return false;
	    var lastSpaceItems = currentMap[xPos][yPos-1];
	    return (currentSpaceItems.indexOf("w") == -1 && lastSpaceItems.indexOf("s") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 3) {
	if (forward) {
	    if (containsArray(solidSpaces, [xPos-1, yPos])) return false;
	    var nextSpaceItems = currentMap[xPos-1][yPos];
	    return (currentSpaceItems.indexOf("a") == -1 && nextSpaceItems.indexOf("d") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    if (containsArray(solidSpaces, [xPos+1, yPos])) return false;
	    var lastSpaceItems = currentMap[xPos+1][yPos];
	    return (currentSpaceItems.indexOf("d") == -1 && lastSpaceItems.indexOf("a") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    return false;
}

// generalized function for triggering a movement event - called by the stepQueue and by keyEvents
function triggerMovement(type) {
    if (type == 'mf') {
	walking = 1;
    }
    else if (type == 'mb') {
	walking = 2;
    }
    else if (type == 'mtl') {
	if (--direction == -1) direction = 3;
	turning = 1;
	rotateTo = camera.rotation.y + (Math.PI/2);
    }
    else if (type == 'mtr') {
	if (++direction == 4) direction = 0;
	turning = 2;
	rotateTo = camera.rotation.y - (Math.PI/2);
    }
    else if (type == 'sync1') {
	sock.send('sync1');
    }
}


function handleInput() {
    if (keys[90]) {
    	sock.send("STOP-MONSTERS");
    }
    if (inControl) {
	if (keys[38] && !turning && !walking && legalMove(direction, true)) {
	    sock.send("mf");
	    if (walking || turning) {
		stepQueue.enqueue('mf');
	    }
	    else {
		triggerMovement('mf');
	    }
	}
	if (keys[40] && !turning && !walking && legalMove(direction, false)) {
	    sock.send("mb");
	    if (walking || turning) {
		stepQueue.enqueue('mb');
	    }
	    else {
		triggerMovement('mb');
	    }
	}
	if (keys[37] && !turning && !walking) {
	    sock.send("mtl");
	    if (walking || turning) {
		stepQueue.enqueue('mtl');
	    }
	    else {
		triggerMovement('mtl');
	    }
	}
	if (keys[39] && !turning && !walking) {
	    sock.send("mtr");
	    if (walking || turning) {
		stepQueue.enqueue('mtr');
	    }
	    else {
		triggerMovement('mtr');
	    }
	}
    }
}

function doTypo(e) {
    if (!inEncounter || didTypo) return;
    if (['up','down','left','right'].indexOf(Mousetrap.charFromEvent(e)) != -1) return;
    $('#'+typeLineCursor+'c'+typeCursor).css("color","red");
    sock.send('t');
    didTypo = true;
}

function encounterHandleInput() {
    $('#'+typeLineCursor+'c'+typeCursor).css("color","green");
    $('#'+typeLineCursor+'c'+typeCursor).css('text-decoration','none');
    if ($('#'+typeLineCursor+'c'+typeCursor).text() == ' ') { // finished typing a word
	lineWords++;
    }
    typeCursor++;
    correctCharacters++;
    Mousetrap.reset();
    
    if (typeCursor == $('#l'+lineOnScreen).text().length) {
	cycleLines();
    }
    
    $('#'+typeLineCursor+'c'+typeCursor).css("color","yellow");
    $('#'+typeLineCursor+'c'+typeCursor).css('text-decoration','underline');
    
    if ($('#l'+lineOnScreen).text()[typeCursor] == ' ')
	Mousetrap.bind('space', encounterHandleInput);
    else {
	Mousetrap.bind($('#l'+lineOnScreen).text()[typeCursor], encounterHandleInput);
    }
    didTypo = false;
    return false;
}

// position "Animation" updating
function update() {
    if (turning == 1) {
	camera.rotation.y += .075;
	if (camera.rotation.y > rotateTo) {
	    camera.rotation.y = rotateTo;
	    turning = false;
	    var nextStep = stepQueue.dequeue();
	    if (nextStep != null) {
		triggerMovement(nextStep);
	    }
	}
    }
    else if (turning == 2) {
	camera.rotation.y -= .075;
	if (camera.rotation.y < rotateTo) {
	    camera.rotation.y = rotateTo;
	    turning = false;
	    var nextStep = stepQueue.dequeue();
	    if (nextStep != null) {
		triggerMovement(nextStep);
	    }
	}
    }

    if (walking == 1) {
	camera.translateZ(-.05);
	walkingCounter++;
	if (walkingCounter >= 20) {
	    walking = false;
	    walkingCounter = 0;
	    switch (direction) {
	    case 0: yPos--; break;
	    case 1: xPos++; break;
	    case 2: yPos++; break;
	    case 3: xPos--; break;
	    default: break;
	    }
	    if (checkNewPosition()) {
		stepQueue = new Queue();
		return;
	    }
	    var nextStep = stepQueue.dequeue();
	    if (nextStep != null) {
		triggerMovement(nextStep);
	    }
	}
    }
    else if (walking == 2) {
	camera.translateZ(.05);
	walkingCounter++;
	if (walkingCounter >= 20) {
	    walking = false;
	    checkNewPosition();
	    walkingCounter = 0;
	    switch (direction) {
	    case 0: yPos++; break;
	    case 1: xPos--; break;
	    case 2: yPos--; break;
	    case 3: xPos++; break;
	    default: break;
	    }
	    if (checkNewPosition()) {
		stepQueue = new Queue();
		return;
	    }
	    var nextStep = stepQueue.dequeue();
	    if (nextStep != null) {
		triggerMovement(nextStep);
	    }
	}
    }

}

render();

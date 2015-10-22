// TypeDungeon by Andrew Barry

window.onload = loadGame;

// IMPORTANT GRAPHICS VARIABLES
var scene = new THREE.Scene();
//var camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
//var hudCamera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 1, 10);
var camera = new THREE.PerspectiveCamera(100, 1, 0.1, 1000);
var hudCamera = new THREE.OrthographicCamera(125 / -2, 125 / 2, 125 / 2, 125 / -2, 1, 10);
var hud = new THREE.Scene();

var renderer = new THREE.WebGLRenderer();
var sock = new WebSocket("ws://game2.andrewbarry.me/ws");
var domEvents = new THREEx.DomEvents(camera, renderer.domElement);
var charactersPerLine = Math.floor((0.8 * window.innerWidth) / 16);


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

// INPUT & MOVEMENT
var keys = [];
var direction = 0;
var turning = false;
var walking = false;
var rotateTo;
var walkingCounter = 0;
var stepQueue;
var inControl = false;

// ENCOUNTER VARIABLES
var inEncounter = false;
var enemySprite;
var enemyWPM;
var enemyHP;
var playerBoxes = [];
var oEHP;
var oPHP;
var wpms = [0,0,0,0];
var typeText;
var typeSrc;
var typeCursor = 0;
var typeLineCursor = 0;
var lineOnScreen = 0;
var currentLineText;
var eHPbar;
var wpmbar;
var pHPbar;
var playerHP;
var correctCharacters = 0;
var encounterStartTime;
var elapsedTime = 0;
var pairTime = 0;
var pairWords = 0;



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
    $('#l1').focus();
    sock.onmessage = onMessage;
    //    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(500,500);
    renderer.setSize(250,250,false);
    //    renderer.setSize(window.innerWidth/4, window.innerHeight/4, false);
    renderer.autoClear = false;
    hudCamera.position.z = 10;
    document.body.appendChild(renderer.domElement);
    var searchCheck = location.search;
    if (searchCheck.split("=").length == 1) {
	loadState(0);
    }
    stepQueue = new Queue();
    sock.onopen = newRoomButton;
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
	    domEvents.removeEventListener(objectsToDraw[x], 'click', function() {}, false);
	    scene.remove(objectsToDraw[x]);
	}
	objectsToDraw = [];
	dynamicTextures = []
    }
    for (var x = 0; x < spritesToDraw.length; x++) {
	hud.remove(spritesToDraw[x]);
    }
    spritesToDraw = [];
    gameState = stateNumber;
    if (gameState == 0) {
	dynamicTextures[0] = new THREEx.DynamicTexture(64,64);
	dynamicTextures[0].clear('red');
	dynamicTextures[0].drawText("Connecting", undefined, 32, 'white');
	var startButtonMaterial = new THREE.MeshBasicMaterial({map:dynamicTextures[0].texture});
	objectsToDraw[objectsToDraw.length] = new THREE.Mesh(buttonGeometry, startButtonMaterial);
	objectsToDraw[0].position.z = -10;
	scene.add(objectsToDraw[0]);

    }
    else if (gameState == 1) { // lobby
	for (var x = 0; x < 4; x++) {
	    dynamicTextures[x] = new THREEx.DynamicTexture(64,64);
	    dynamicTextures[x].clear(colors[x]);
	}
	for (var x = 0; x < 4; x++) {
	    if (x < players.length && players[x] != undefined && players[x].name != undefined) {
		dynamicTextures[x].drawText(players[x].name, undefined, 32, 'black');
	    }
	    else {
		dynamicTextures[x].drawText("Waiting...", undefined, 32, 'black');
	    }
	}
	dynamicTextures[4] = new THREEx.DynamicTexture(512,512);
	dynamicTextures[4].clear('black');
	dynamicTextures[4].drawText("Share the link in your location bar with friends. Click here when ready.", undefined, 256, 'white');
	var greenMat = new THREE.MeshBasicMaterial({map:dynamicTextures[0].texture});
	var redMat = new THREE.MeshBasicMaterial({map:dynamicTextures[1].texture});
	var blueMat = new THREE.MeshBasicMaterial({map:dynamicTextures[2].texture});
	var whiteMat = new THREE.MeshBasicMaterial({map:dynamicTextures[3].texture});
	var readyMat = new THREE.MeshBasicMaterial({map:dynamicTextures[4].texture});
	objectsToDraw[0] = new THREE.Mesh(buttonGeometry, greenMat);
	objectsToDraw[0].position.set(-10,7,-10);
	objectsToDraw[1] = new THREE.Mesh(buttonGeometry, redMat);
	objectsToDraw[1].position.set(-10,-7,-10);
	objectsToDraw[2] = new THREE.Mesh(buttonGeometry, blueMat);
	objectsToDraw[2].position.set(10,7,-10);
	objectsToDraw[3] = new THREE.Mesh(buttonGeometry, whiteMat);
	objectsToDraw[3].position.set(10,-7,-10);
	objectsToDraw[4] = new THREE.Mesh(hugeButtonGeometry, readyMat);
	objectsToDraw[4].position.set(0,0,-11);
	domEvents.addEventListener(objectsToDraw[4], 'click', function(event) { sock.send("ready"); dynamicTextures[4].clear('black'); dynamicTextures[4].drawText("Waiting for all players to be ready...", undefined, 256, 'white'); }, false);
	for (var x = 0; x < objectsToDraw.length; x++) {
	    scene.add(objectsToDraw[x]);
	}
	window.history.replaceState('Object','Title','/?room=' + room_id);

    }
    else if (gameState == 3) { // loading next map
	playerHP = 150;
	oPHP = playerHP;
	currentMap = [];
	var loadingDT = new THREEx.DynamicTexture(1024,1024);
	loadingDT.clear('black');
	loadingDT.drawText("Moving to Next Floor...", undefined, 512, 'white', '40pt Arial');
	var loadingMat = new THREE.SpriteMaterial({map: loadingDT.texture});
	var loadingSp = new THREE.Sprite(loadingMat);
	spritesToDraw[0] = loadingSp;
	var sW = loadingMat.map.image.width;
	var sH = loadingMat.map.image.height;
	loadingSp.scale.set(sW,sH,1);
	hud.add(loadingSp);
	loadingSp.position.set(0,0,1);
	sock.send("prepm");
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
	
	for (var x = 0; x < playerIndeces.length; x++) {
	    var cP = players[playerIndeces[x]];
	    var cPDT = new THREEx.DynamicTexture(150,40);
	    cPDT.texture.minFilter = THREE.NearestFilter;
	    cPDT.texture.magFilter = THREE.NearestFilter;
	    cPDT.clear(colors[playerIndeces[x]]);
	    cPDT.drawText(cP.name, 5, 15, 'black', '12pt Arial');
	    cPDT.drawText("wpm: " + cP.wpm, 5, 35, 'black', '12pt Arial');
	    var cPMat = new THREE.SpriteMaterial({map: cPDT.texture});
	    var cPSp = new THREE.Sprite(cPMat);
	    cPSp.scale.set(cPMat.map.image.width, cPMat.map.image.height, 1);
	    cPSp.position.set(spPos[x], (-1 * window.innerHeight/2) + 25, 1);
	    dynamicTextures[dynamicTextures.length] = cPDT;
	    spritesToDraw[spritesToDraw.length] = cPSp;
	    hud.add(cPSp);
	    playerBoxes.push(cPDT);
	}
	enemySprite.minFilter = THREE.NearestFilter;
	enemySprite.magFilter = THREE.NearestFilter;
	var eMat = new THREE.SpriteMaterial({map: enemySprite});
	var eSp = new THREE.Sprite(eMat);
	//	var scaleFactor = Math.min(
	//    (window.innerHeight/1.5)/eMat.map.image.height,
	//    (window.innerWidth/2)/eMat.map.image.width);
	eSp.scale.set(eMat.map.image.width, eMat.map.image.height, 1);
	eSp.position.set(0,0,1);
	spritesToDraw[spritesToDraw.length] = eSp;
	hud.add(eSp);

	eHPbar = new THREEx.DynamicTexture(75, 315);
	eHPbar.texture.minFilter = THREE.NearestFilter;
	eHPbar.texture.magFilter = THREE.NearestFilter;
	var eHPMat = new THREE.SpriteMaterial({map: eHPbar.texture});
	var eHPSp = new THREE.Sprite(eHPMat);
	spritesToDraw[spritesToDraw.length] = eHPSp;
	dynamicTextures[dynamicTextures.length] = eHPbar;
	eHPSp.scale.set(eHPMat.map.image.width, eHPMat.map.image.height, 1);
	//eHPSp.position.set((window.innerWidth / 4) + 55,0,1);
	//eHPSp.position.set(75,0,1);
	updateEHPBar();
	hud.add(eHPSp);
	pHPbar = new THREEx.DynamicTexture(75, 315);
	pHPbar.texture.minFilter = THREE.NearestFilter;
	pHPbar.texture.magFilter = THREE.NearestFilter;
	var pHPMat = new THREE.SpriteMaterial({map: pHPbar.texture});
	var pHPSp = new THREE.Sprite(pHPMat);
	spritesToDraw[spritesToDraw.length] = pHPSp;
	dynamicTextures[dynamicTextures.length] = pHPbar;
	pHPSp.scale.set(pHPMat.map.image.width, pHPMat.map.image.height, 1);
	//pHPSp.position.set((window.innerWidth / 4),0,1);
	//pHPSp.position.set(-25,0,1);
	updatePHPBar();
	hud.add(pHPSp);

	wpmbar = new THREEx.DynamicTexture(75, 315);
	wpmbar.texture.minFilter = THREE.NearestFilter;
	wpmbar.texture.magFilter = THREE.NearestFilter;
	var wpmMat = new THREE.SpriteMaterial({map: wpmbar.texture});
	var wpmSp = new THREE.Sprite(wpmMat);
	spritesToDraw[spritesToDraw.length] = wpmSp;
	dynamicTextures[dynamicTextures.length] = wpmbar;
	wpmSp.scale.set(wpmMat.map.image.width, wpmMat.map.image.height, 1);
	//wpmSp.position.set(-1 * window.innerWidth / 4, 0, 1);
	updateWPMBar();
	hud.add(wpmSp);
    }
    else if (stateNumber == 4) { // entering new floor or exiting fight
	inEncounter = false;
	$('#typeText').hide();
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
	    }
	}
	bufferedMap = [];
	loadState(3);
    }
    else if (message.startsWith("you,")) { // letting you know your credentials
	var my_info = message.split(",");
	var my_id = my_info[1];
	var yourName = prompt("What is your name?");
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
    else if (message.startsWith("quit,")) { // player quit the room
	var qid = parseInt(message.split(",")[1]);
	for (var x = 0; x < 4; x++) {
	    if (players[x].id == qid) {
		players[x] = undefined;
		if (gameState == 1) {
		    dynamicTextures[x].clear(colors[x]);
		    dynamicTextures[x].drawText("Waiting...", undefined, 32, "black");
		    dynamicTextures[x].needsUpdate = true;
		}
	    }
	}
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
		dynamicTextures[x].clear(colors[x]);
		dynamicTextures[x].drawText(j_name, undefined, 32, 'black');
		dynamicTextures[x].needsUpdate = true;
		players[x] = new Player(j_uid, j_name);
		break;
	    }
	}
    }
    else if (message == 'noroom') {
	alert("Room not found. Create your own!");
	loadState(0);
    }
    
}

// onMessage for loading maps
function loadingOnMessage(message) {
    if (message == "done") {
	typeSrc = "";
	typeCursor = 0;
	loadState(4);
    }
    else if (message == 'sync0') { // ignore sync0 message - we already know.
	return;
    }
    else if (message.startsWith("S")) {
	var sLocInfo = message.split(",");
	xPos = parseInt(sLocInfo[1]);
	yPos = parseInt(sLocInfo[2]);
	camera.position.set(xPos,0,yPos);
    }
    else if (message.startsWith("F")) {
	var fLocInfo = message.split(",");
	exitX = parseInt(fLocInfo[1]);
	exitY = parseInt(fLocInfo[2]);
    }
    else if (message.startsWith("WN")) { // number of wall paths
	numTotalWalls = parseInt(message.split(',')[1]);
	numWalls = 0;
    }
    else if (message.startsWith("WP")) { // wall path
	var token = message.split(',')[1];
	var path = message.split(',')[2];
	THREE.ImageUtils.loadTexture('assets/' + path + "-wall.png", undefined, function(t) {
	    t.minFilter = THREE.NearestFilter;
	    t.magFilter = THREE.NearestFilter;
	    textures[token] = t;
	    numWalls++;
	    if (numWalls == numTotalWalls) {
		loadSpaceX = 0;
		loadSpaceY = 0;
		for (var b = 0; b < bufferedMap.length; b++) {
		    var bMap = bufferedMap[b];
		    var oi = objectsToDraw.length;
		    var spaces = bMap.split(",");
		    
		    var floorGeom = new THREE.BoxGeometry(1,0,1);
		    var wallGeomHoriz = new THREE.BoxGeometry(0,1,1);
		    var wallGeomVert = new THREE.BoxGeometry(1,1,0);
		    currentMap[currentMap.length] = spaces;
		    for (var x = 0; x < spaces.length; x++) {
			var items_at_space = spaces[x];
			for (var i = 0; i < items_at_space.length; i+= 2) {
			    var item = items_at_space.charAt(i);
			    var mat = new THREE.MeshBasicMaterial({map:textures[items_at_space.charAt(i+1)]});
			    if (item == 'f') {
				objectsToDraw[oi] = new THREE.Mesh(floorGeom, mat);
				objectsToDraw[oi].position.set(loadSpaceX, -.5, loadSpaceY);
			    }
			    else if (item == 'c') {
				objectsToDraw[oi] = new THREE.Mesh(floorGeom, mat);
				objectsToDraw[oi].position.set(loadSpaceX, .5, loadSpaceY);
			    }
			    else if (item == 'd') {
				objectsToDraw[oi] = new THREE.Mesh(wallGeomHoriz, mat);
				objectsToDraw[oi].position.set(loadSpaceX + 0.5, 0, loadSpaceY);
			    }
			    else if (item == 'a') {
				objectsToDraw[oi] = new THREE.Mesh(wallGeomHoriz, mat);
				objectsToDraw[oi].position.set(loadSpaceX - 0.5, 0, loadSpaceY);
			    }
			    else if (item == 's') {
				objectsToDraw[oi] = new THREE.Mesh(wallGeomVert, mat);
				objectsToDraw[oi].position.set(loadSpaceX, 0, loadSpaceY + 0.5);
			    }
			    else if (item == 'w') {
				objectsToDraw[oi] = new THREE.Mesh(wallGeomVert, mat);
				objectsToDraw[oi].position.set(loadSpaceX, 0, loadSpaceY - 0.5);
			    }
			    if ('wasdfc'.indexOf(item) != -1) {
				scene.add(objectsToDraw[oi++]);
			    }
			}
			loadSpaceY++;
		    }
		    loadSpaceX++;
		    loadSpaceY = 0;
		} // end of final for
		sock.send('sync0');
	    }
	}, null);


	textures[token] = path;
    }
    else {
	bufferedMap[bufferedMap.length] = message;
    }
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


    else if (message == 'grant') {
	inControl = true;
    }
    else if (message == 'revoke') {
	    inControl = false;
    }
    
    // sync
    else if (message == 'sync1') {
	if (walking || turning) {
	    stepQueue.enqueue('sync1');
	}
	else {
	    sock.send('sync1');
	}
    }

    else if (message.startsWith('esp')) {
	THREE.ImageUtils.loadTexture('assets/' + message.split(':')[1], undefined, function(esp) {
	    enemySprite = esp;
	    $.ajax({url:'text/get.py', method:'POST', data: {"l":charactersPerLine, "n":typeLineCursor}, success: function(r) {
		var tt = r.split("\n");
		typeSrc = tt[0];
		typeText = [];
		typeCursor = 0;
		pairWords = 0;
		lineOnScreen = 0;
		pairTime = Date.now();
		encounterStartTime = Date.now();
		window.setTimeout(calculateWPM,1000);
		for (var x = 1; x < 11; x++) {
		    typeText[x-1] = tt[x];
		}
		$('#l0').html(typeText[0]);
		$('#l1').html(typeText[1]);
		$('#'+typeLineCursor+'c0').css('color','yellow');
		$('#'+typeLineCursor+'c0').css('text-decoration','underline');
		Mousetrap.bind($('#l0').text()[typeCursor], encounterHandleInput);
		currentLineText = $('#l0').text();
		sock.send('sync2');
	    }});
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

function calculateWPM() {

    elapsedTime = (Date.now() - encounterStartTime)/1000;
    yourPlayer.wpm = Math.floor((12 * correctCharacters) / elapsedTime);
    sock.send("w," + yourPlayer.wpm);
    
    if (inEncounter) {
	window.setTimeout(calculateWPM,1000);
    }
    updateWPMBar();
    updatePlayerBoxes();
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
	    loadState(4);
	}
	else {
	    updateEHPBar();
	}
    }
    else if (message.startsWith("d")) { // player takes damage
	playerHP -= parseInt(message.split(",")[1]);
	if (playerHP <= 0) { // you died
	    loadState(4);
	}
	else {
	    updatePHPBar();
	}
    }

    // TODO - damage reports for player/enemy, end-of-battle stuff
}

function totalWPM() {
    var tot = 0;
    for (var x = 0; x < players.length; x++) {
	if (players[x] != null) {
	    tot += players[x].wpm;
	}
    }
    return tot;
}

function updateEHPBar() {
    var pixelTick = (oEHP / 300);
    var pixelsOfRed = parseInt(enemyHP / pixelTick);
    eHPbar.context.fillStyle = 'black';
    eHPbar.clear();
    eHPbar.context.fillRect(0,15,25,315);
    eHPbar.context.fillStyle = 'red';
    eHPbar.context.fillRect(0,315-pixelsOfRed,25,315);
    eHPbar.drawText(enemyHP,30,325-pixelsOfRed,'red');
    eHPbar.drawText("enemy HP",0,12,'red');
}

function updatePHPBar() {
    var pixelTick = (oPHP / 300);
    var pixelsOfBlue = parseInt(playerHP / pixelTick);
    pHPbar.context.fillStyle = 'black';
    pHPbar.clear();
    pHPbar.context.fillRect(0,15,25,315);
    pHPbar.context.fillStyle = 'blue';
    pHPbar.context.fillRect(0,315-pixelsOfBlue,25,315);
    pHPbar.drawText(playerHP,30,325-pixelsOfBlue,'blue');
    pHPbar.drawText("your HP",0,12,'blue');
}

function updateWPMBar() {
    var twpm = totalWPM();
    var pixelTick = (enemyWPM*2) / 300;
    var pixelsOfRed = 150;
    var pixelsOfBlue = Math.min(300, parseInt(twpm / pixelTick));
    wpmbar.context.fillStyle = 'black';
    wpmbar.clear();
    wpmbar.context.fillRect(0,15,25,315);
    wpmbar.context.fillStyle = 'red';
    wpmbar.context.fillRect(0,165,25,315);
    wpmbar.drawText(enemyWPM,30,165,'red');
    wpmbar.drawText("WPM",0,12,'red');
    wpmbar.context.fillStyle = 'blue';
    wpmbar.context.fillRect(0,315-pixelsOfBlue,25,315);
    wpmbar.drawText(twpm,30,305-pixelsOfBlue,'blue');
}

function updatePlayerBoxes() {
    for (var x  =0; x < playerBoxes.length; x++) {
	var cP = players[playerIndeces[x]];
	playerBoxes[x].clear(colors[playerIndeces[x]]);
	playerBoxes[x].drawText(cP.name, 5, 15, 'black', '12pt Arial');
	playerBoxes[x].drawText("wpm: " + cP.wpm, 5, 35, 'black', '12pt Arial');
    }
}

function cycleLines() {
    typeCursor = 0;
    if (lineOnScreen == 0) { // finished writing first line
	$('#l0').html(typeText[typeLineCursor+2]);
	lineOnScreen++;
	currentLineText = $('#l1').text();
    }
    else { // finished writing second line - update & send Pair WPM
	$('#l1').html(typeText[typeLineCursor+2]);
	currentLineText = $('#l1').text();
	var pairTotalTime = Date.now() - pairTime;
	var pairWPM = parseInt(Math.floor((60 * pairWords) / (pairTotalTime / 1000)));
	sock.send('p,'+pairWPM)
	pairTime = Date.now();
	pairWords = 0;
	lineOnScreen = 0;
    }
    typeLineCursor++;
    if (typeLineCursor + 3 == typeText.length) { // getting close to the end of our text - fetch more
	$.ajax({url:'text/get.py', method:'POST', data: {"src": typeSrc, "l":charactersPerLine, "n":typeLineCursor+3}, success: function(r) {
	    var nwords = r.split("\n");
	    for (var x = 1; x < nwords.length; x++) {
		typeText.push(nwords[x]);
	    }
	}});
    }
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

function legalMove(direc,forward) {
    var currentSpaceItems = currentMap[xPos][yPos];
    if (direc == 0) {
	if (forward) {
	    var nextSpaceItems = currentMap[xPos][yPos-1];
	    return (currentSpaceItems.indexOf("w") == -1 && nextSpaceItems.indexOf("s") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    var lastSpaceItems = currentMap[xPos][yPos+1];
	    return (currentSpaceItems.indexOf("s") == -1 && lastSpaceItems.indexOf("w") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 1) {
	if (forward) {
	    var nextSpaceItems = currentMap[xPos+1][yPos];
	    return (currentSpaceItems.indexOf("d") == -1 && nextSpaceItems.indexOf("a") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    var lastSpaceItems = currentMap[xPos-1][yPos];
	    return (currentSpaceItems.indexOf("a") == -1 && lastSpaceItems.indexOf("d") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 2) {
	if (forward) {
	    var nextSpaceItems = currentMap[xPos][yPos+1];
	    return (currentSpaceItems.indexOf("s") == -1 && nextSpaceItems.indexOf("w") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
	    var lastSpaceItems = currentMap[xPos][yPos-1];
	    return (currentSpaceItems.indexOf("w") == -1 && lastSpaceItems.indexOf("s") == -1 && lastSpaceItems.indexOf("f") != -1);
	}
    }
    else if (direc == 3) {
	if (forward) {
	    var nextSpaceItems = currentMap[xPos-1][yPos];
	    return (currentSpaceItems.indexOf("a") == -1 && nextSpaceItems.indexOf("d") == -1 && nextSpaceItems.indexOf("f") != -1);
	}
	else {
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

function doTypo() {
    if (!inEncounter) return;
    $('#'+typeLineCursor+'c'+typeCursor).css("color","red");
    sock.send('t');
}

function encounterHandleInput() {
    $('#'+typeLineCursor+'c'+typeCursor).css("color","green");
    $('#'+typeLineCursor+'c'+typeCursor).css('text-decoration','none');
    if ($('#'+typeLineCursor+'c'+typeCursor).text() == ' ') { // finished typing a word
	pairWords++;
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
}

// position "Animation" updating
function update() {
    //    shadMat.uniforms.cPos = camera.position;
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
	    walkingCounter = 0;
	    switch (direction) {
	    case 0: yPos++; break;
	    case 1: xPos--; break;
	    case 2: yPos--; break;
	    case 3: xPos++; break;
	    default: break;
	    }
	    var nextStep = stepQueue.dequeue();
	    if (nextStep != null) {
		triggerMovement(nextStep);
	    }
	}
    }

}

render();

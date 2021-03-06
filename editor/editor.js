// TypeDungeon level editor

window.onload = load;

var cursorX = 0;
var cursorY = 0;

var startX = -1;
var startY = -1;

var finishX = -1;
var finishY = -1;

var gridWidth = 10;
var gridHeight = 10;

var placements = [];

var placedObjectInfo = {};

var textFile;
var mapText = "";

var token = "";
var placingWalls = false;

var selectedEnemies = [];

function load() {
    hideControls();
    $('#wallType').hide();
    $('#objectWindow').hide();
    $.ajax({url:"walls.py",method:"POST", success:function(r) {
	document.getElementById("wallType").innerHTML = r;
	document.getElementById("wallType").onchange = function() {
	    if (document.getElementById("wallType").selectedIndex == 0) {
		placingWalls = false;
	    }
	    else {
		placingWalls = true;
		token = document.getElementById("wallType").options[document.getElementById("wallType").selectedIndex].id;
	    }
	};
	drawGrid(gridWidth,gridHeight);
	placeCursor(cursorX,cursorY);
	moveCursor(5,5);
	$("#loading").text("Loading object list, wait some moar");
	$.ajax({url: "objs.py", method:"POST", success: function(r2) {
	    $('#loading').hide();
	    document.getElementById("objType").innerHTML = r2;
	    document.getElementById("objType").onchange = function() {
		placedObjectInfo[cursorX+','+cursorY].objIndex = document.getElementById("objType").selectedIndex;
	    };
	    document.getElementById("objSolid").onchange = function() {
		placedObjectInfo[cursorX+','+cursorY].solid = !placedObjectInfo[cursorX+','+cursorY].solid;
	    };
	    $('#wallType').show();
	    $('#loading').text("Loading enemies, please wait even moar");
		$.ajax({url: "enemies.py", method:"POST", success: function(r3) {
		    document.getElementById("enemyPick").innerHTML = r3;
		    document.getElementById("enemyPick").onchange = function() {
			if (selectedEnemies.indexOf(
			    document.getElementById("enemyPick").options[
			    document.getElementById("enemyPick").selectedIndex].innerHTML) == -1) {
			    $('#enemyAction').text('Add');
			}
			else {
			    $('#enemyAction').text('Remove');
			}
		    };
		    $('#loading').text();
		}});
	}});
    }});
}

function hideControls() {
    if ($('#hidecontrols')[0].innerHTML == 'Hide Controls') {
	$('#controls').hide();
	$('#hidecontrols')[0].innerHTML = 'Show Controls';
    }
    else {
	$('#controls').show();
	$('#hidecontrols')[0].innerHTML = 'Hide Controls';
    }
}

function drawGrid(lines,cols) {
    var ihtml = "";
    for (var x = 0; x < cols; x++) {
	ihtml += " ___";
    }
    ihtml += "\n";
    for (var l = 0; l < lines; l++) {
	for (var x = 0; x < cols; x++) {
	    ihtml += "|<span id='"+x+","+l+"c'> </span><span id='"+x+","+l+"w'> </span><span id='"+x+","+l+"f'> </span>";
	}
	ihtml += "|\n";
	for (var x = 0; x < cols; x++) {
	    ihtml += "|<span id='"+x+","+l+"a'> </span><span id='c"+x+","+l+"'> </span><span id='"+x+","+l+"d'> </span>";
	}
	ihtml += "|\n";
	for (var x = 0; x < cols; x++) {
	    ihtml += "|<u><span id='"+x+","+l+"o'> </span><span id='"+x+","+l+"s'> </span><span id='"+x+","+l+"r'> </span></u>";
	}
	ihtml += "|\n";
    }
    $('#grid')[0].innerHTML = ihtml;
    if (placements.length != cols) {
	var amnt = cols - placements.length;
	for (var x = 0; x < amnt; x++) {
	    placements[placements.length] = [];
	    for (var y = 0; y < lines; y++) {
		placements[placements.length-1][y] = '';
	    }
	}
    }
    if (placements[0].length != lines) {
	var amnt = lines - placements[0].length;
	for (var x = 0; x < placements.length; x++) {
	    for (var y = 0; y < amnt; y++) {
		placements[x][placements[x].length] = '';
	    }
	}
    }
}

function placeCursor(cx, cy) {
    $('#c'+cx+'\\,'+cy).css('background-color','yellow');
    showObjectWindow();
}
function moveCursor(nx,ny) {
    $('#c'+cursorX+'\\,'+cursorY).css('background-color','white');
    cursorX = nx;
    cursorY = ny;
    placeCursor(nx,ny);
    if (placements[cursorX][cursorY].indexOf("o") % 2 == 0) {
	showObjectWindow();
    }
}

function showObjectWindow() {
    try {
	$('#objSolid').prop('checked', placedObjectInfo[cursorX+','+cursorY].solid);
	$('#objType').prop('selectedIndex',placedObjectInfo[cursorX+','+cursorY].objIndex);
	$('#objectWindow').show();
    } catch(e) {
	$('#objectWindow').hide();
    }
}
function hideObjectWindow() {
    $('#objectWindow').hide();
}

function updateMap() {
    if (startX == -1 || finishX == -1) {
	alert("Place the start and the finish before saving.");
	return;
    }

    for (var x = 0; x < selectedEnemies.length; x++) {
	mapText += selectedEnemies[x] + ",";
    }
    mapText = mapText.substring(mapText.length - 1) + "\n";

    var walls = document.getElementById("wallType").options;

    mapText = "WN," + (walls.length-1) + "\n";
    mapText += "MN," + placements.length + "\n";
    mapText += "ON," + Object.keys(placedObjectInfo).length + "\n";
    mapText += "S," + startX + "," + startY + "\nF," + finishX + "," + finishY + "\n";

    for (var x = 0; x < placements.length; x++) {
	for (var y = 0; y < placements[x].length; y++) {
	    mapText += placements[x][y];
	    try {
		var obj = placedObjectInfo[x + ',' + y];
		var token = document.getElementById("objType").options[parseInt(obj.objIndex)].id.split(",")[1];
		mapText += 'o';
		mapText += token;
		if (obj.solid) mapText += "1";
		else mapText += "0";
	    } catch(e) {}
	    mapText += ",";
	}
	mapText = mapText.substring(0,mapText.length-1) + "\n";
    }
    for (var x = 1; x < walls.length; x++) {
	var wallToken = walls[x].id;
	var wallName = walls[x].innerHTML.split(" ")[0];
	mapText+= "WP," + wallToken + "," + wallName + "\n";
    }
    var objs = document.getElementById("objType").options;
    for (var x = 0; x < objs.length; x++) {
	var objName = objs[x].innerHTML.split(' ')[0];
	var objToken = objs[x].id.split(',')[1];
	mapText += "OP," + objToken + ',' + objName + "\n";
    }

    document.getElementById("savegame").href = saveMap(mapText);
    
}

function saveMap(text) {
    var data = new Blob([text], {type: "text/plain"});
    if (textFile != null) {
	window.URL.revokeObjectURL(textFile);
    }
    textFile = window.URL.createObjectURL(data);
    return textFile;
}

window.onkeydown = function(k) {
    
    // moving cursor
    if (k.keyCode == 37 && cursorX != 0) { // left
	moveCursor(cursorX - 1, cursorY);
    }
    else if (k.keyCode == 38 && cursorY != 0) { // up
	moveCursor(cursorX, cursorY - 1);
    }
    else if (k.keyCode == 39 && cursorX != gridWidth - 1) { // right
	moveCursor(cursorX + 1, cursorY);
    }
    else if (k.keyCode == 40 && cursorY != gridHeight - 1) { // down
	moveCursor(cursorX, cursorY + 1);
    }

    // changing map size
    else if (k.keyCode == 220) { // new column
	drawGrid(gridHeight,gridWidth+1);
	gridWidth++;
	drawWalls();
	placeCursor(cursorX,cursorY);
    }
    else if (k.keyCode == 173 || k.keyCode == 189) { // new line
	drawGrid(gridHeight+1,gridWidth);
	gridHeight++;
	drawWalls();
	placeCursor(cursorX,cursorY);
    }

    // placing walls/floors/ceilings
    else if (k.keyCode == 87 && placingWalls) { // w
	var elem = $('#'+cursorX+'\\,'+cursorY+'w')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('w'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 'w'+token;
	}
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('w'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }
    else if (k.keyCode == 65 && placingWalls) { // a
	var elem = $('#'+cursorX+'\\,'+cursorY+'a')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('a'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 'a'+token;
	}
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('a'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }
    else if (k.keyCode == 83 && placingWalls) { // s
	var elem = $('#'+cursorX+'\\,'+cursorY+'s')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('s'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 's'+token;
	}  
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('s'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }
    else if (k.keyCode == 68 && placingWalls) { // d
	var elem = $('#'+cursorX+'\\,'+cursorY+'d')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('d'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 'd'+token;
	}
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('d'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }
    else if (k.keyCode == 67 && placingWalls) { // c
	var elem = $('#'+cursorX+'\\,'+cursorY+'c')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('c'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 'c'+token;
	}
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('c'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }
    else if (k.keyCode == 70 && placingWalls) { // f
	var elem = $('#'+cursorX+'\\,'+cursorY+'f')[0];
	if (elem.innerHTML != token) {
	    if (elem.innerHTML != "") {
		placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('f'+elem.innerHTML,'');
	    }
	    elem.innerHTML = token;
	    placements[cursorX][cursorY] += 'f'+token;
	}
	else {
	    placements[cursorX][cursorY] = placements[cursorX][cursorY].replace('f'+elem.innerHTML,'');
	    elem.innerHTML = ' ';
	}
    }

    //object placement
    else if (k.keyCode == 79) { // o
	var elem = $('#'+cursorX+'\\,'+cursorY+'o')[0];
	if (elem.innerHTML != 'o') {
	    placedObjectInfo[cursorX+','+cursorY] = {solid: false, objIndex: 0};
	    $('#'+cursorX+'\\,'+cursorY+'o').text('o');
	    showObjectWindow();
	}
	else {
	    delete placedObjectInfo[cursorX+','+cursorY];
	    $('#'+cursorX+'\\,'+cursorY+'o').text(' ');
	    hideObjectWindow();
	}
    }

    // player start / finish
    else if (k.keyCode == 32) { // place player start
	if (cursorX != finishX || cursorY != finishY) {
	    var elem = $('#c'+cursorX+'\\,'+cursorY)[0];
	    if (startX != -1) {
		var selem = $('#c'+startX+'\\,'+startY)[0];
		selem.innerHTML = ' ';
	    }
	    elem.innerHTML = 'S';
	    startX = cursorX;
	    startY = cursorY;
	}
    }
    else if (k.keyCode == 13) { // place player finish
	if (cursorX != startX || cursorY != startY) {
	    var elem = $('#c'+cursorX+'\\,'+cursorY)[0];
	    if (finishX != -1) {
		var felem = $('#c'+finishX+'\\,'+finishY)[0];
		felem.innerHTML = ' ';
	    }
	    elem.innerHTML = 'F';
	    finishX = cursorX;
	    finishY = cursorY;
	}
    }

}

function modEnemy() {
    var selectedEnemy = document.getElementById("enemyPick").options[
	document.getElementById("enemyPick").selectedIndex].innerHTML;
    if (selectedEnemies.indexOf(selectedEnemy) == -1) {
	selectedEnemies.push(selectedEnemy);
	$('#enemyArea').text($('#enemyArea').text() + "\n" + selectedEnemy);
	$('#enemyAction').text('Remove');
    }
    else {
	var index = selectedEnemies.indexOf(selectedEnemy);
	selectedEnemies.splice(index, 1);
	$('#enemyArea').text($('#enemyArea').text().replace("\n" + selectedEnemy, ""));
	$('#enemyAction').text('Add');
    }
    $('#enemyArea').text($('#enemyArea').text().trim());
}

function drawWalls() {
    for (var x = 0; x < placements.length; x++) {
	for (var y = 0; y < placements[x].length; y++) {
	    var cStr = placements[x][y];
	    for (var z = 0; z < cStr.length; z+= 2) {
		var c = cStr.charAt(z);
		$('#'+x+'\\,'+y+c)[0].innerHTML = cStr.charAt(z+1);
	    }
	}
    }

    for (var o in placedObjectInfo) {
	console.log(o);
	var x = parseInt(o.split(',')[0]);
	var y = parseInt(o.split(',')[1]);
	$('#' + x + '\\,' + y + 'o').text('o');
    }


    if (startX != -1) {
	$('#c'+startX+'\\,'+startY)[0].innerHTML = 'S';
    }
    if (finishX != -1) {
	$('#c'+finishX+'\\,'+finishY)[0].innerHTML = 'F';
    }
}

const socket = io();

/* charcter class */
class Character {
    constructor(name, elementId) {
        this.name = name;
        this.maxHp = 100;
        this.hp = 100;
        this.isBlocking = false;
		this.block = 0;
        this.elementId = elementId;
		this.color = "#cde5ea";
    }
}

var player1;
var player2;
var currentPlayer;
var opponentPlayer;
var playerNumber = 0;
var isTurn = false;

/* after page loads, do this */
window.onload = function() {
	/* Player 1 */
	player1 = new Character("Player 1", "player-1-elements");
	/* Player 2 */
	player2 = new Character("Player 2", "player-2-elements");
	currentPlayer = player1;
	opponentPlayer = player2;

	// color button choices
	const allColorOptions = document.querySelectorAll('.color-options');

	allColorOptions.forEach(container => {
		const pType = container.getAttribute('data-player');
		const buttons = container.querySelectorAll('.color-btn');

		// default name colors
		document.querySelector('#player-1-elements h2').style.color = "#cde5ea";
    	document.querySelector('#player-2-elements h2').style.color = "#cde5ea";

		// when buttons clicked
		buttons.forEach(btn => {
			btn.onclick = function() {
				// player can't pick the other ones color
				if (pType == "p1" && playerNumber != 1 || pType == "p2" && playerNumber != 2){
					console.log("Only choose your color");
					return;
				}

				const chosenColor = this.getAttribute('data-color');

				// tell the other player the chosen color
				socket.emit('playerAction', {
					type: 'colorSelect',
					color: chosenColor,
					player: playerNumber
				});

				// update color visually
				updatePlayerColor(playerNumber, chosenColor);
			};
		});
	});

	/* button functionality */
	document.getElementById("attack").onclick = attack;
	document.getElementById("block").onclick = block;
	document.getElementById("heal").onclick = heal;
	
	document.getElementById("start").onclick = startGame;
	document.getElementById("play-again").onclick = function() {
		socket.emit('playerAction', { type: 'playAgain' });
		location.reload();
	};


}

/* ---------- Client Stuff ---------- */

// when new player connects
socket.on('player', (num) => {
    playerNumber = num;
    console.log("You are Player " + playerNumber);

    // Player 1 starts first
    if (playerNumber == 1) {
        isTurn = true;
    } else {
        isTurn = false;
    }
});

// when other player has done something
socket.on('updateGame', (action) => {
	updateGameState(action);
});

function updateGameState(action) {
	// start of game setup
	if (action.type == 'gameStart') {
		startSetup();
		return;
	}
	// sync player colors
	if (action.type == 'colorSelect') {
		updatePlayerColor(action.player, action.color);
		return;
	}
	// game restart
	if (action.type == 'gameEnd') {
		gameEnd();
	}
	if (action.type == 'playAgain') {
		location.reload();
		return;
	}
	

	// determine which player just moved
	var actor = (action.player == 1) ? player1 : player2;
    var target = (action.player == 1) ? player2 : player1;

	// what to change based on action
    if (action.type == 'attack') {
        target.hp = action.hp;
        updateActionLog(actor.name + " dealt " + action.damage + " damage", actor.color);
		target.isBlocking = false;
        target.block = 0;
    } else if (action.type == 'heal') {
        actor.hp = action.hp;
        updateActionLog(actor.name + " healed 5 hp", actor.color);
    } else if (action.type == 'block') {
		if (action.idle == true){
			updateActionLog(actor.name + " sits idly (still blocking for " + actor.block + " damage against next attack)", actor.color);
		}
		else {
			actor.isBlocking = action.isBlocking;
			actor.block = action.block;
			updateActionLog(actor.name + " blocks " + action.block + " damage against next attack", actor.color);
		}  
    }
    
    // update visually
    updateHealthBars();
	// check game over
	checkGameOver();
	// switch turn
	isTurn = true;
    switchTurn();
}



/* ---------- Action functions ---------- */
function attack() {
	// can't move if not your turn
	if (!isTurn){return;}

	var damage = randomize(2, 20);
	if (opponentPlayer.isBlocking == false) {
		opponentPlayer.hp -= damage;
	}
	// opponent is blocking
	else {
		damage = damage - opponentPlayer.block;
		if (damage < 0){damage = 0;}
		opponentPlayer.hp -= (damage);
		opponentPlayer.isBlocking = false;
		opponentPlayer.block = 0;
	}
	// strong attack animation
	if (damage >= 15) {
		triggerShake(opponentPlayer.elementId);
	}
	if (opponentPlayer.hp < 0) {opponentPlayer.hp = 0;}
	// emits move to other player
	socket.emit('playerAction', {
        type: 'attack',
        damage: damage,
        hp: opponentPlayer.hp,
		player: playerNumber
    });
	// updates visual health bar
	updateHealthBars();
	// updates action log
	updateActionLog(currentPlayer.name + " dealt " + damage + " damage", currentPlayer.color);
	// check for game over
	checkGameOver();	
	// switches turn
	isTurn = false;
	switchTurn();
	
}

function block() {
	// can't move if not your turn
	if (!isTurn){return;}

	var block = currentPlayer.block;
	if (currentPlayer.isBlocking == false)
	{
		block = randomize(0, 10);
		currentPlayer.block = block;
		currentPlayer.isBlocking = true;
		// emits move to other player
		socket.emit('playerAction', {
			type: 'block',
			block: block,
			isBlocking: true,
			player: playerNumber,
			idle: false
		});
		// updates action log
		updateActionLog(currentPlayer.name + " blocks " + block + " damage against next attack", currentPlayer.color);
	}
	// player already blocking
	else {
		// updates action log
		updateActionLog(currentPlayer.name + " sits idly (still blocking for " + currentPlayer.block + " damage against next attack)", currentPlayer.color);
		// emits move to other player
		socket.emit('playerAction', {
			type: 'block',
			block: block,
			isBlocking: true,
			player: playerNumber,
			idle: true
		});
	}
	// switches turn
	isTurn = false;
	switchTurn();
}

function heal() {
	// can't move if not your turn
	if (!isTurn){return;}

	currentPlayer.hp += 5;
	if (currentPlayer.hp > currentPlayer.maxHp){currentPlayer.hp = currentPlayer.maxHp;}
	// emits move to other player
	socket.emit('playerAction', {
        type: 'heal',
        hp: currentPlayer.hp,
		player: playerNumber
    });
	// updates visual health bar
	updateHealthBars();
	// updates action log
	updateActionLog(currentPlayer.name + " healed 5 hp", currentPlayer.color);
	// switches turn
	isTurn = false;
	switchTurn();
}

/* calculates random number for attack and block */
function randomize(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/*------------------------------------------------*/

/* switches turn */
function switchTurn() {
	var tempCurrPlayer = currentPlayer;
	currentPlayer = opponentPlayer;
	opponentPlayer = tempCurrPlayer;
	var turn = document.getElementById("turn-text");
	turn.textContent = currentPlayer.name + "'s Turn";
	turn.style.color = currentPlayer.color;
}

/* updates action log */
function updateActionLog (message, messageColor) {
	var log = document.getElementById("action-log");
	var newMessage = document.createElement('ul');
	newMessage.textContent = message;
	newMessage.style.color = messageColor;
	log.prepend(newMessage);

}

/* when start button pressed */
function startGame() {
	// tell the other player to start
	socket.emit('playerAction', { type: 'gameStart' });
	startSetup();
}

/* function so both clients run the setup at the same time */
function startSetup() {
	var turn = document.getElementById("turn-text");
	turn.textContent = "Player 1's Turn";
	var Startbtn = document.getElementById('start');
	Startbtn.classList.add('hidden');
	document.getElementById("setup-menu").remove();
	var actionMenu = document.getElementById("action-menu");
	actionMenu.classList.remove('hidden');
}

/* function so both clients have the same colors */
function updatePlayerColor(pNum, chosenColor){
	// visual change in player label when color is chosen
	if (pNum == 1) {
		player1.color = chosenColor;
		document.querySelector('#player-1-elements h2').style.color = chosenColor;
	} else {
		player2.color = chosenColor;
		document.querySelector('#player-2-elements h2').style.color = chosenColor;
	}

	// visual change in button when color is chosen
	const selector = (pNum == 1) ? '.color-options[data-player="p1"] .color-btn' : '.color-options[data-player="p2"] .color-btn';
    const playerButtons = document.querySelectorAll(selector);
    playerButtons.forEach(btn => {
        btn.style.border = "2px solid #cde5ea";
        if (btn.getAttribute('data-color') === chosenColor) {
            btn.style.border = "3px solid #605804";
        }
    });
}

/* checks for game over */
function checkGameOver() {
	if (player1.hp <= 0 || player2.hp <= 0) {
		// tell the other player to start
		socket.emit('playerAction', { type: 'gameEnd' });
		endGame();
	}
}

/* function so both clients end game at the same time */
function gameEnd() {
	var winner = player1.hp > 0 ? player1.name : player2.name;
	document.getElementById("action-menu").remove();
	var turn = document.getElementById("turn-text");
	turn.textContent = winner + " Won!";
	var btn = document.getElementById('play-again');
	btn.classList.remove('hidden');
}

/* updates health bars */
function updateHealthBars() {
	// calculate new health percentage
    let p1Percent = (player1.hp / player1.maxHp) * 100;
    let p2Percent = (player2.hp / player2.maxHp) * 100;
    // can't go lower than 0
    p1Percent = Math.max(0, p1Percent);
    p2Percent = Math.max(0, p2Percent);
	// visual width update
    let p1Bar = document.getElementById("player-1-health-fill");
    let p2Bar = document.getElementById("player-2-health-fill");
    p1Bar.style.width = p1Percent + "%";
    p2Bar.style.width = p2Percent + "%";
    // visual color update (if needed)
    updateBarColor(p1Bar, p1Percent);
    updateBarColor(p2Bar, p2Percent);
    // visual number update
    document.getElementById("player-1-health-text").textContent = Math.ceil(player1.hp);
    document.getElementById("player-2-health-text").textContent = Math.ceil(player2.hp);
}
/* health bar color based on current hp */
function updateBarColor(barElement, percent) {
    if (percent < 25) {
        barElement.style.backgroundColor = "#ff4d4d";
    } else if (percent < 50) {
        barElement.style.backgroundColor = "#ffd11a";
    } else {
        barElement.style.backgroundColor = "#4caf50";
    }
}


/* animation */
function triggerShake(playerID) {
	var player = document.getElementById(playerID);
	player.classList.add("shake");
	setTimeout(function() 
				{player.classList.remove('shake');}
			  , 500);
}
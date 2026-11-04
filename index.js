const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = 3000;


app.use(express.static('public'));
app.use(express.urlencoded());
app.use(express.json());


// serve pages in public folder to client
app.use(express.static('public'));

// start player count at 1 so first player is Player 1
playerCount = 1;

// when a client connects to the server
io.on('connection', (socket) => {
    
    // to establish which client is player 1 vs 2
    socket.emit('player', playerCount);
    console.log('Player ' + playerCount + ' connected!');
    playerCount++;
    

    // when a client does something
    socket.on('playerAction', (action) => {
        // tell the other player
        socket.broadcast.emit('updateGame', action);
    });

    // when a client disconnects from the server
    socket.on('disconnect', () => {
        console.log('User disconnected');
        if (io.engine.clientsCount === 0) {
          // reset player numbers if no more clients
          playerCount = 1; 
      }
    });
});

http.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

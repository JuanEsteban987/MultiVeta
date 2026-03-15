const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const game = new Game(io);

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // El cliente envía su nombre al conectarse
  socket.on('join', (playerName) => {
    game.addPlayer(socket.id, playerName);
  });

  // Movimiento
  socket.on('move', (direction) => {
    game.movePlayer(socket.id, direction);
  });

  // Disparo
  socket.on('shoot', (targetX, targetY) => {
    game.shootProjectile(socket.id, targetX, targetY);
  });

  // Desconexión
  socket.on('disconnect', () => {
    game.removePlayer(socket.id);
  });
});

server.listen(3000, () => {
  console.log('Servidor escuchando en http://localhost:3000');
});

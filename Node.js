// game.js
class Player {
  constructor(id, name, x, y) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.health = 100;
    this.weapon = null;
    this.speed = 5;
    // Otros atributos: dirección, estado, etc.
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      health: this.health,
      weapon: this.weapon,
    };
  }
}

class Game {
  constructor(io) {
    this.io = io;                 // Instancia de Socket.io
    this.players = new Map();      // Mapa de jugadores (id -> Player)
    this.projectiles = [];         // Proyectiles activos
    this.mapWidth = 2000;
    this.mapHeight = 2000;
    this.lootItems = [];           // Objetos en el mapa (armas, curaciones, etc.)
    
    // Loop principal del juego (60 ticks por segundo)
    this.tickRate = 1000 / 60;
    this.gameLoop = setInterval(() => this.update(), this.tickRate);
  }

  // Agregar un nuevo jugador
  addPlayer(socketId, playerName) {
    // Posición inicial aleatoria dentro del mapa
    const x = Math.random() * this.mapWidth;
    const y = Math.random() * this.mapHeight;
    const player = new Player(socketId, playerName, x, y);
    this.players.set(socketId, player);

    // Notificar a todos los clientes
    this.io.emit('player-joined', player.toJSON());
    console.log(`Jugador conectado: ${playerName} (${socketId})`);
    
    return player;
  }

  // Eliminar un jugador (desconexión o muerte)
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.io.emit('player-left', socketId);
      console.log(`Jugador desconectado: ${player.name} (${socketId})`);
    }
  }

  // Manejar movimiento enviado por el cliente
  movePlayer(socketId, direction) {
    const player = this.players.get(socketId);
    if (!player) return;

    // Actualizar posición según dirección (simplificado)
    switch(direction) {
      case 'up':    player.y -= player.speed; break;
      case 'down':  player.y += player.speed; break;
      case 'left':  player.x -= player.speed; break;
      case 'right': player.x += player.speed; break;
    }

    // Limitar dentro del mapa
    player.x = Math.max(0, Math.min(this.mapWidth, player.x));
    player.y = Math.max(0, Math.min(this.mapHeight, player.y));

    // No enviamos actualización inmediata, el loop broadcast enviará todos los estados
  }

  // Disparar un proyectil
  shootProjectile(socketId, targetX, targetY) {
    const player = this.players.get(socketId);
    if (!player || !player.weapon) return;

    // Crear proyectil (posición inicial = jugador, dirección hacia target)
    const angle = Math.atan2(targetY - player.y, targetX - player.x);
    const projectile = {
      id: Math.random().toString(36).substring(7),
      ownerId: socketId,
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * 10,
      vy: Math.sin(angle) * 10,
      damage: player.weapon.damage,
      range: player.weapon.range,
      distanceTraveled: 0,
    };
    this.projectiles.push(projectile);

    // Notificar a los clientes (opcional, pero puede ser manejado en el loop)
    this.io.emit('projectile-fired', projectile);
  }

  // Actualización del juego (cada tick)
  update() {
    // Mover proyectiles y verificar colisiones
    this.updateProjectiles();

    // Generar loot (aleatorio, cada cierto tiempo)
    // ...

    // Enviar estado actual a todos los clientes
    this.broadcastState();
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      
      // Mover
      p.x += p.vx;
      p.y += p.vy;
      p.distanceTraveled += Math.hypot(p.vx, p.vy);

      // Eliminar si excede alcance o sale del mapa
      if (p.distanceTraveled > p.range || 
          p.x < 0 || p.x > this.mapWidth || p.y < 0 || p.y > this.mapHeight) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Colisiones con jugadores (excepto el dueño)
      for (const [id, player] of this.players) {
        if (id === p.ownerId) continue;
        // Detección simple de colisión (distancia)
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist < 20) { // asumiendo radio de jugador 20px
          player.takeDamage(p.damage);
          this.projectiles.splice(i, 1);
          
          if (player.health <= 0) {
            this.killPlayer(player.id);
          }
          break;
        }
      }
    }
  }

  killPlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      // Aquí podrías convertir al jugador en espectador o eliminar
      this.removePlayer(playerId);
      this.io.emit('player-died', playerId);
    }
  }

  broadcastState() {
    // Enviar solo datos relevantes (posiciones, salud, proyectiles)
    const playersData = {};
    this.players.forEach((player, id) => {
      playersData[id] = player.toJSON();
    });

    this.io.volatile.emit('game-state', {
      players: playersData,
      projectiles: this.projectiles.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        // No enviamos toda la info si no es necesaria
      })),
      // loot: this.lootItems, (opcional)
    });
  }

  // Detener el loop al cerrar el servidor
  stop() {
    clearInterval(this.gameLoop);
  }
}

module.exports = Game;

const socket = io();

// Elementos UI
const joinScreen = document.getElementById('join-screen');
const drawingApp = document.getElementById('drawing-app');
const roomInput = document.getElementById('room-input');
const createBtn = document.getElementById('create-room-btn');
const joinBtn = document.getElementById('join-room-btn');
const roomDisplay = document.getElementById('room-display');
const roleDisplay = document.getElementById('role-display');
const toolsContainer = document.getElementById('tools-container');
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const toolSelect = document.getElementById('toolSelect');
const clearBtn = document.getElementById('clearCanvas');
const viewerList = document.getElementById('viewerList');
const chatMessages = document.getElementById('chatMessages');
const usernameInput = document.getElementById('usernameInput');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMessage');

// Estado local
let currentRoom = null;
let isStreamer = false;
let drawing = false;
let startX, startY;
let lastX, lastY;

// Configuración del canvas
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.strokeStyle = colorPicker.value;
ctx.fillStyle = colorPicker.value;
ctx.lineWidth = brushSizeInput.value;
ctx.font = '16px Arial';

// Eventos de dibujo (solo si es streamer)
canvas.addEventListener('mousedown', (e) => {
    if (!isStreamer) return;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    lastX = pos.x;
    lastY = pos.y;

    if (toolSelect.value === 'pencil') {
        drawing = true;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        sendDrawAction({
            type: 'draw_start',
            x: lastX,
            y: lastY,
            color: colorPicker.value,
            size: brushSizeInput.value
        });
    } else if (toolSelect.value === 'text') {
        const text = prompt('Escribe el texto:');
        if (text) {
            const action = {
                type: 'text',
                text: text,
                x: startX,
                y: startY,
                color: colorPicker.value,
                size: brushSizeInput.value
            };
            drawText(action);
            sendDrawAction(action);
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isStreamer || !drawing) return;
    const pos = getMousePos(e);
    const x = pos.x;
    const y = pos.y;

    if (toolSelect.value === 'pencil') {
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSizeInput.value;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        sendDrawAction({
            type: 'draw',
            x: x,
            y: y,
            color: colorPicker.value,
            size: brushSizeInput.value
        });

        lastX = x;
        lastY = y;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!isStreamer) return;
    if (toolSelect.value === 'pencil' && drawing) {
        drawing = false;
        ctx.beginPath();
        sendDrawAction({ type: 'draw_end' });
    } else if (toolSelect.value !== 'pencil' && toolSelect.value !== 'text') {
        // Forma
        const pos = getMousePos(e);
        const action = {
            type: 'shape',
            shape: toolSelect.value,
            x: startX,
            y: startY,
            x2: pos.x,
            y2: pos.y,
            color: colorPicker.value,
            size: brushSizeInput.value
        };
        drawShape(action);
        sendDrawAction(action);
    }
});

canvas.addEventListener('mouseout', () => {
    if (drawing) {
        drawing = false;
        ctx.beginPath();
        sendDrawAction({ type: 'draw_end' });
    }
});

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// Funciones de dibujo (para aplicar acciones recibidas)
function drawShape(action) {
    ctx.save();
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.beginPath();
    if (action.shape === 'rectangle') {
        ctx.rect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
        ctx.stroke();
    } else if (action.shape === 'circle') {
        const radius = Math.sqrt((action.x2 - action.x) ** 2 + (action.y2 - action.y) ** 2);
        ctx.arc(action.x, action.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (action.shape === 'line') {
        ctx.moveTo(action.x, action.y);
        ctx.lineTo(action.x2, action.y2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawText(action) {
    ctx.save();
    ctx.fillStyle = action.color;
    ctx.font = `${action.size * 3}px Arial`;
    ctx.fillText(action.text, action.x, action.y);
    ctx.restore();
}

function drawStart(action) {
    ctx.beginPath();
    ctx.moveTo(action.x, action.y);
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
}

function drawMove(action) {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.size;
    ctx.lineTo(action.x, action.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(action.x, action.y);
}

function drawEnd() {
    ctx.beginPath();
}

// Enviar acción de dibujo al servidor
function sendDrawAction(action) {
    if (!currentRoom || !isStreamer) return;
    socket.emit('draw-action', { roomId: currentRoom, action });
}

// Unirse a sala
function joinRoom(roomId, asStreamer) {
    socket.emit('join-room', { roomId, asStreamer });
    currentRoom = roomId;
    roomDisplay.textContent = roomId;
    joinScreen.style.display = 'none';
    drawingApp.style.display = 'flex';
}

createBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim() || 'sala' + Math.random().toString(36).substring(2, 6);
    joinRoom(roomId, true);
});

joinBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (!roomId) return alert('Ingresa un código de sala');
    joinRoom(roomId, false);
});

// Eventos de Socket.IO
socket.on('streamer-assigned', () => {
    isStreamer = true;
    roleDisplay.textContent = ' (Streamer)';
    toolsContainer.style.display = 'flex';
});

socket.on('viewer-assigned', () => {
    isStreamer = false;
    roleDisplay.textContent = ' (Espectador)';
    toolsContainer.style.display = 'none';
});

socket.on('error', (msg) => {
    alert(msg);
    joinScreen.style.display = 'block';
    drawingApp.style.display = 'none';
});

socket.on('drawing-history', (history) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let action of history) {
        applyAction(action);
    }
});

socket.on('draw-action', (action) => {
    applyAction(action);
});

function applyAction(action) {
    switch (action.type) {
        case 'draw_start':
            drawStart(action);
            break;
        case 'draw':
            drawMove(action);
            break;
        case 'draw_end':
            drawEnd();
            break;
        case 'shape':
            drawShape(action);
            break;
        case 'text':
            drawText(action);
            break;
        case 'clear':
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            break;
    }
}

socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('chat-message', ({ user, message }) => {
    addChatMessage(user, message);
});

socket.on('user-list', (users) => {
    updateViewerList(users);
});

socket.on('streamer-left', () => {
    alert('El streamer abandonó la sala. Volviendo al inicio.');
    joinScreen.style.display = 'block';
    drawingApp.style.display = 'none';
});

// Chat
sendBtn.addEventListener('click', sendChatMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function sendChatMessage() {
    const user = usernameInput.value.trim() || 'Anon';
    const message = messageInput.value.trim();
    if (!message || !currentRoom) return;
    socket.emit('chat-message', { roomId: currentRoom, user, message });
    messageInput.value = '';
}

function addChatMessage(user, message) {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<span class="user">${escapeHtml(user)}:</span> <span class="text">${escapeHtml(message)}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Lista de espectadores
function updateViewerList(users) {
    let html = '';
    if (users.streamer) {
        html += `<li>🟣 Streamer (${users.streamer.substr(0, 4)}...)</li>`;
    }
    users.viewers.forEach(id => {
        html += `<li>👤 Espectador (${id.substr(0, 4)}...)</li>`;
    });
    viewerList.innerHTML = html || '<li>No hay espectadores</li>';
}

// Limpiar canvas (solo streamer)
clearBtn.addEventListener('click', () => {
    if (!isStreamer) return;
    if (confirm('¿Limpiar todo el canvas?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('clear-canvas', { roomId: currentRoom });
    }
});

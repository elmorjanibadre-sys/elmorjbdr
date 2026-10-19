// Serveur temps réel de Chatly : utilisateurs, présence, messages privés,
// accusés de réception et indicateur de saisie. Stockage en mémoire.
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const MAX_TEXT_LENGTH = 4000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// username -> { username, online, lastSeen }
const users = new Map();
// username -> nombre de connexions actives (un utilisateur peut avoir plusieurs appareils)
const connections = new Map();
// Liste chronologique de tous les messages
const messages = [];
let nextId = 1;

const room = (username) => `user:${username}`;

function publicUsers() {
  return [...users.values()];
}

function broadcastPresence() {
  io.emit('users', publicUsers());
}

function conversationOf(username) {
  return messages.filter((m) => m.from === username || m.to === username);
}

function setStatus(message, status) {
  message.status = status;
  io.to(room(message.from)).emit('message:status', { id: message.id, status });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, users: users.size, messages: messages.length });
});

io.on('connection', (socket) => {
  let me = null;

  socket.on('login', (payload, ack = () => {}) => {
    const username = String(payload?.username || '').trim();
    if (!/^[\p{L}\p{N}_ .-]{2,24}$/u.test(username)) {
      return ack({ error: 'Nom invalide (2 à 24 caractères).' });
    }
    me = username;
    socket.join(room(me));
    connections.set(me, (connections.get(me) || 0) + 1);
    users.set(me, { username: me, online: true, lastSeen: Date.now() });

    // Les messages reçus pendant que l'utilisateur était hors ligne sont maintenant livrés
    for (const m of messages) {
      if (m.to === me && m.status === 'sent') setStatus(m, 'delivered');
    }

    ack({ username: me, users: publicUsers(), messages: conversationOf(me) });
    broadcastPresence();
  });

  socket.on('message:send', (payload, ack = () => {}) => {
    if (!me) return ack({ error: 'Non connecté.' });
    const to = String(payload?.to || '');
    const text = String(payload?.text || '').trim();
    if (!users.has(to)) return ack({ error: 'Destinataire inconnu.' });
    if (!text) return ack({ error: 'Message vide.' });

    const message = {
      id: String(nextId++),
      from: me,
      to,
      text: text.slice(0, MAX_TEXT_LENGTH),
      createdAt: Date.now(),
      status: 'sent',
    };
    messages.push(message);

    ack({ message });
    // Envoyé aux autres appareils de l'expéditeur et au destinataire
    socket.to(room(me)).emit('message:new', message);
    io.to(room(to)).emit('message:new', message);
    if (users.get(to).online) setStatus(message, 'delivered');
  });

  socket.on('messages:read', (payload) => {
    if (!me) return;
    const from = String(payload?.from || '');
    for (const m of messages) {
      if (m.from === from && m.to === me && m.status !== 'read') setStatus(m, 'read');
    }
  });

  socket.on('typing', (payload) => {
    if (!me) return;
    const to = String(payload?.to || '');
    io.to(room(to)).emit('typing', { from: me, isTyping: Boolean(payload?.isTyping) });
  });

  socket.on('disconnect', () => {
    if (!me) return;
    const remaining = (connections.get(me) || 1) - 1;
    connections.set(me, remaining);
    if (remaining === 0) {
      users.set(me, { username: me, online: false, lastSeen: Date.now() });
      broadcastPresence();
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Chatly server listening on port ${PORT}`));
}

module.exports = { server, io };

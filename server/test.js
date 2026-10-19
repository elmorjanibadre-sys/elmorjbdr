// Test d'intégration : deux clients échangent un message et suivent ses statuts.
const assert = require('assert');
const { io: client } = require('socket.io-client');
const { server, io } = require('./index');

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}`;
  const alice = client(url);
  const bob = client(url);
  try {
    assert.ok((await emit(alice, 'login', { username: 'x' })).error, 'nom trop court refusé');

    await emit(alice, 'login', { username: 'Alice' });
    const bobLogin = await emit(bob, 'login', { username: 'Bob' });
    assert.deepStrictEqual(bobLogin.users.map((u) => u.username).sort(), ['Alice', 'Bob']);

    const received = once(bob, 'message:new');
    const delivered = once(alice, 'message:status');
    const { message } = await emit(alice, 'message:send', { to: 'Bob', text: 'Salut Bob !' });
    assert.strictEqual((await received).text, 'Salut Bob !');
    assert.deepStrictEqual(await delivered, { id: message.id, status: 'delivered' });

    const typing = once(alice, 'typing');
    bob.emit('typing', { to: 'Alice', isTyping: true });
    assert.deepStrictEqual(await typing, { from: 'Bob', isTyping: true });

    const read = once(alice, 'message:status');
    bob.emit('messages:read', { from: 'Alice' });
    assert.deepStrictEqual(await read, { id: message.id, status: 'read' });

    console.log('OK : tous les tests passent');
  } finally {
    alice.close();
    bob.close();
    io.close();
  }
});

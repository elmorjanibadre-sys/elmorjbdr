import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { SERVER_URL } from './src/config';
import LoginScreen from './src/screens/LoginScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';

const USERNAME_KEY = 'chatly:username';

export default function App() {
  const socketRef = useRef(null);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [openChat, setOpenChat] = useState(null);
  const [connected, setConnected] = useState(false);
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(USERNAME_KEY)
      .then((name) => name && setSavedName(name))
      .catch(() => {});
  }, []);

  // Retour Android : ferme la conversation au lieu de quitter l'app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!openChat) return false;
      setOpenChat(null);
      return true;
    });
    return () => sub.remove();
  }, [openChat]);

  const login = useCallback(
    (username) =>
      new Promise((resolve) => {
        socketRef.current?.disconnect();
        const socket = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        const doLogin = () =>
          socket.emit('login', { username }, (res) => {
            if (res.error) {
              socket.disconnect();
              return resolve(res.error);
            }
            setMe(res.username);
            setUsers(res.users);
            setMessages(res.messages);
            AsyncStorage.setItem(USERNAME_KEY, res.username).catch(() => {});
            resolve(null);
          });

        // Se reconnecter automatiquement après une coupure réseau
        socket.on('connect', () => {
          setConnected(true);
          doLogin();
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => resolve('Serveur injoignable : ' + SERVER_URL));

        socket.on('users', setUsers);
        socket.on('message:new', (message) =>
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message])),
        );
        socket.on('message:status', ({ id, status }) =>
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m))),
        );
        socket.on('typing', ({ from, isTyping }) =>
          setTyping((prev) => ({ ...prev, [from]: isTyping })),
        );
      }),
    [],
  );

  const logout = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    AsyncStorage.removeItem(USERNAME_KEY).catch(() => {});
    setMe(null);
    setOpenChat(null);
    setMessages([]);
    setUsers([]);
  }, []);

  const sendMessage = useCallback((to, text) => {
    socketRef.current?.emit('message:send', { to, text }, (res) => {
      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message],
        );
      }
    });
  }, []);

  const markRead = useCallback((from) => {
    socketRef.current?.emit('messages:read', { from });
  }, []);

  const sendTyping = useCallback((to, isTyping) => {
    socketRef.current?.emit('typing', { to, isTyping });
  }, []);

  useEffect(() => () => socketRef.current?.disconnect(), []);

  let screen;
  if (!me) {
    screen = <LoginScreen initialName={savedName} onLogin={login} />;
  } else if (openChat) {
    screen = (
      <ChatScreen
        me={me}
        contact={users.find((u) => u.username === openChat) || { username: openChat }}
        messages={messages.filter(
          (m) =>
            (m.from === me && m.to === openChat) || (m.from === openChat && m.to === me),
        )}
        isTyping={Boolean(typing[openChat])}
        onBack={() => setOpenChat(null)}
        onSend={(text) => sendMessage(openChat, text)}
        onRead={() => markRead(openChat)}
        onTyping={(isTyping) => sendTyping(openChat, isTyping)}
      />
    );
  } else {
    screen = (
      <ChatsScreen
        me={me}
        users={users}
        messages={messages}
        typing={typing}
        connected={connected}
        onOpen={setOpenChat}
        onLogout={logout}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen}
    </SafeAreaProvider>
  );
}

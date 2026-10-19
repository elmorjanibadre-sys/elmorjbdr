import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { colors } from '../theme';
import { formatLastSeen, formatTime } from '../format';

const TYPING_TIMEOUT_MS = 2000;

function StatusTicks({ status }) {
  const ticks = status === 'sent' ? '✓' : '✓✓';
  return <Text style={[styles.ticks, status === 'read' && styles.ticksRead]}>{ticks}</Text>;
}

export default function ChatScreen({ me, contact, messages, isTyping, onBack, onSend, onRead, onTyping }) {
  const [text, setText] = useState('');
  const typingTimer = useRef(null);
  const typingSent = useRef(false);

  // Liste inversée : le message le plus récent en bas
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const hasUnread = messages.some((m) => m.from === contact.username && m.status !== 'read');
  useEffect(() => {
    if (hasUnread) onRead();
  }, [hasUnread, onRead]);

  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      if (typingSent.current) onTyping(false);
    },
    [onTyping],
  );

  function handleChange(value) {
    setText(value);
    if (!typingSent.current) {
      typingSent.current = true;
      onTyping(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingSent.current = false;
      onTyping(false);
    }, TYPING_TIMEOUT_MS);
  }

  function send() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    clearTimeout(typingTimer.current);
    typingSent.current = false;
    onTyping(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Avatar name={contact.username} size={40} />
        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>
            {contact.username}
          </Text>
          <Text style={styles.headerStatus}>
            {isTyping ? 'écrit…' : contact.lastSeen ? formatLastSeen(contact) : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={
            <Text style={styles.empty}>Envoie le premier message à {contact.username} 👋</Text>
          }
          renderItem={({ item }) => {
            const mine = item.from === me;
            return (
              <View style={[styles.bubble, mine ? styles.outgoing : styles.incoming]}>
                <Text style={styles.messageText}>{item.text}</Text>
                <View style={styles.meta}>
                  <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                  {mine && <StatusTicks status={item.status} />}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleChange}
            placeholder="Message"
            multiline
            maxLength={4000}
          />
          <Pressable
            style={[styles.send, !text.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!text.trim()}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  back: { paddingHorizontal: 8 },
  backText: { color: '#fff', fontSize: 34, lineHeight: 36 },
  headerBody: { flex: 1, marginLeft: 10 },
  headerName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerStatus: { color: '#D6EFE6', fontSize: 13 },
  body: { flex: 1, backgroundColor: colors.background },
  messages: { padding: 10, flexGrow: 1 },
  empty: {
    // La liste est inversée : on retourne le texte pour qu'il s'affiche à l'endroit
    transform: [{ scaleY: -1 }],
    textAlign: 'center',
    color: colors.muted,
    marginTop: 24,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    marginVertical: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  outgoing: { alignSelf: 'flex-end', backgroundColor: colors.outgoing, borderTopRightRadius: 2 },
  incoming: { alignSelf: 'flex-start', backgroundColor: colors.incoming, borderTopLeftRadius: 2 },
  messageText: { fontSize: 16, color: colors.text },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 11, color: colors.muted },
  ticks: { fontSize: 12, color: colors.muted, marginLeft: 4 },
  ticksRead: { color: colors.read },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8 },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: 20 },
});

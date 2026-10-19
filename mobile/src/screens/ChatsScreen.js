import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { colors } from '../theme';
import { formatLastSeen, formatTime } from '../format';

export default function ChatsScreen({ me, users, messages, typing, connected, onOpen, onLogout }) {
  const [query, setQuery] = useState('');

  // Une ligne par contact, triée par date du dernier message
  const rows = useMemo(() => {
    return users
      .filter((u) => u.username !== me)
      .filter((u) => u.username.toLowerCase().includes(query.trim().toLowerCase()))
      .map((user) => {
        const conversation = messages.filter(
          (m) => (m.from === me && m.to === user.username) || (m.from === user.username && m.to === me),
        );
        const last = conversation[conversation.length - 1];
        const unread = conversation.filter((m) => m.from === user.username && m.status !== 'read').length;
        return { user, last, unread };
      })
      .sort((a, b) => (b.last?.createdAt || 0) - (a.last?.createdAt || 0));
  }, [users, messages, me, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Chatly</Text>
          <Text style={styles.headerSubtitle}>
            {connected ? `Connecté en tant que ${me}` : 'Connexion en cours…'}
          </Text>
        </View>
        <Pressable onPress={onLogout} hitSlop={10}>
          <Text style={styles.logout}>Déconnexion</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un contact"
          autoCorrect={false}
        />
      </View>

      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(row) => row.user.username}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun autre utilisateur pour l'instant.{'\n'}Connecte un deuxième téléphone pour discuter !
          </Text>
        }
        renderItem={({ item: { user, last, unread } }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onOpen(user.username)}
          >
            <Avatar name={user.username} online={user.online} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.username}
                </Text>
                {last && (
                  <Text style={[styles.time, unread > 0 && styles.timeUnread]}>
                    {formatTime(last.createdAt)}
                  </Text>
                )}
              </View>
              <View style={styles.rowTop}>
                <Text
                  style={[styles.preview, typing[user.username] && styles.typing]}
                  numberOfLines={1}
                >
                  {typing[user.username]
                    ? 'écrit…'
                    : last
                      ? `${last.from === me ? 'Toi : ' : ''}${last.text}`
                      : formatLastSeen(user)}
                </Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#D6EFE6', fontSize: 13, marginTop: 2 },
  logout: { color: '#fff', fontSize: 14 },
  searchBox: { paddingHorizontal: 12, paddingBottom: 12 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  list: { flex: 1, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  rowPressed: { backgroundColor: '#F4F4F4' },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: colors.muted, marginLeft: 8 },
  timeUnread: { color: colors.accent, fontWeight: '600' },
  preview: { flex: 1, fontSize: 14, color: colors.muted, marginTop: 3 },
  typing: { color: colors.accent, fontStyle: 'italic' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 76 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, lineHeight: 22 },
});

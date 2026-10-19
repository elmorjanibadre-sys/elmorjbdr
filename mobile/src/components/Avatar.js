import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { initials } from '../format';

const PALETTE = ['#E57373', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#4DB6AC', '#F06292'];

// Couleur stable dérivée du nom
function colorFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function Avatar({ name, online, size = 52 }) {
  return (
    <View>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name) },
        ]}
      >
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      </View>
      {online && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

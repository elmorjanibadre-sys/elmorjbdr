import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function LoginScreen({ initialName, onLogin }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setName(initialName), [initialName]);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    const err = await onLogin(name.trim());
    setLoading(false);
    if (err) setError(err);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.title}>Bienvenue sur Chatly</Text>
        <Text style={styles.subtitle}>Choisis un nom pour commencer à discuter.</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ton nom"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={24}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, name.trim().length < 2 && styles.buttonDisabled]}
          disabled={name.trim().length < 2 || loading}
          onPress={submit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continuer</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: { color: '#fff', fontSize: 44, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 15, textAlign: 'center', color: colors.muted, marginTop: 8, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  error: { color: '#C62828', marginTop: 10 },
  button: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

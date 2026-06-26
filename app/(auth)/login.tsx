import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'confirm';

export default function LoginScreen() {
  const [mode,            setMode]            = useState<Mode>('signin');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [confirmedEmail,  setConfirmedEmail]  = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  function switchMode(m: 'signin' | 'signup') {
    setMode(m);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  function validate(): string | null {
    const trimmed = email.trim();
    if (!trimmed)              return 'Email address is required.';
    if (!trimmed.includes('@')) return 'Enter a valid email address.';
    if (password.length < 6)   return 'Password must be at least 6 characters.';
    if (mode === 'signup' && password !== confirmPassword)
      return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (mode === 'signin') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email:    trimmedEmail,
        password,
      });
      setLoading(false);
      if (authError) { setError(authError.message); return; }
      router.replace('/(app)/(tabs)/map');
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email:    trimmedEmail,
        password,
      });
      setLoading(false);
      if (authError) { setError(authError.message); return; }
      if (data.session) {
        // Email confirmation disabled in Supabase project — user is already signed in
        router.replace('/(app)/(tabs)/map');
      } else {
        setConfirmedEmail(trimmedEmail);
        setMode('confirm');
      }
    }
  }

  // ── Confirm state ──────────────────────────────────────────────────────────

  if (mode === 'confirm') {
    return (
      <View style={styles.confirmContainer}>
        <View style={styles.confirmIconWrap}>
          <Text style={styles.confirmIconText}>✉</Text>
        </View>
        <Text style={styles.confirmTitle}>Check your email</Text>
        <Text style={styles.confirmBody}>
          A confirmation link was sent to
        </Text>
        <Text style={styles.confirmedEmail}>{confirmedEmail}</Text>
        <Text style={styles.confirmBody}>
          Click the link to activate your account,{'\n'}then return here to sign in.
        </Text>
        <Pressable
          style={[styles.submitBtn, { marginTop: 32 }]}
          onPress={() => switchMode('signin')}
        >
          <Text style={styles.submitBtnText}>Back to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // ── Sign-in / Sign-up form ─────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoMads}>MADS</Text>
          <Text style={styles.logoSub}>FLIGHT COMMANDER</Text>
          <Text style={styles.logoTagline}>Drone Fleet Management</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeBar}>
          <Pressable
            style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
            onPress={() => switchMode('signin')}
          >
            <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
            onPress={() => switchMode('signup')}
          >
            <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
              Create Account
            </Text>
          </Pressable>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={t => { setEmail(t); setError(null); }}
            placeholder="you@example.com"
            placeholderTextColor="#44445a"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              ref={passwordRef}
              style={styles.passwordInput}
              value={password}
              onChangeText={t => { setPassword(t); setError(null); }}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
              placeholderTextColor="#44445a"
              secureTextEntry={!showPassword}
              returnKeyType={mode === 'signup' ? 'next' : 'done'}
              onSubmitEditing={mode === 'signup'
                ? () => confirmRef.current?.focus()
                : handleSubmit}
            />
            <Pressable
              style={styles.revealBtn}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={8}
            >
              <Text style={styles.revealBtnText}>
                {showPassword ? 'HIDE' : 'SHOW'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Confirm password (sign-up only) */}
        {mode === 'signup' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              ref={confirmRef}
              style={styles.input}
              value={confirmPassword}
              onChangeText={t => { setConfirmPassword(t); setError(null); }}
              placeholder="Repeat password"
              placeholderTextColor="#44445a"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.submitBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
          }
        </Pressable>

        {/* Footer note for sign-up mode */}
        {mode === 'signup' && (
          <Text style={styles.footerNote}>
            After creating your account, an admin will need to set your role
            to operator before you can control drones.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  kav:    { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 48 },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoMads: {
    fontSize:      52,
    fontWeight:    '900',
    color:         '#00d4ff',
    letterSpacing: 6,
    lineHeight:    56,
  },
  logoSub: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#555566',
    letterSpacing: 4,
    marginTop:     4,
  },
  logoTagline: {
    fontSize:   12,
    color:      '#333348',
    marginTop:  6,
    letterSpacing: 0.5,
  },

  // Mode toggle
  modeBar: {
    flexDirection:   'row',
    backgroundColor: SURFACE,
    borderRadius:    12,
    padding:         3,
    marginBottom:    24,
    borderWidth:     1,
    borderColor:     BORDER,
  },
  modeTab: {
    flex:          1,
    paddingVertical: 10,
    borderRadius:  10,
    alignItems:    'center',
  },
  modeTabActive:     { backgroundColor: '#1e1e38' },
  modeTabText:       { color: '#44445a', fontSize: 13, fontWeight: '600' },
  modeTabTextActive: { color: '#ffffff' },

  // Field
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
    marginBottom:  6,
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color:           '#ffffff',
    fontSize:        15,
  },

  // Password field with show/hide
  passwordWrap: {
    flexDirection:   'row',
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    alignItems:      'center',
  },
  passwordInput: {
    flex:            1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color:           '#ffffff',
    fontSize:        15,
  },
  revealBtn:     { paddingHorizontal: 14, paddingVertical: 13 },
  revealBtnText: { color: '#44445a', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  // Error
  errorBox: {
    backgroundColor: '#ff444418',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     '#ff444433',
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginBottom:    12,
  },
  errorText: { color: '#ff6666', fontSize: 13, lineHeight: 18 },

  // Submit button
  submitBtn: {
    backgroundColor: '#00d4ff',
    borderRadius:    12,
    paddingVertical: 15,
    alignItems:      'center',
    marginTop:       4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#000000', fontWeight: '700', fontSize: 16 },

  // Footer note
  footerNote: {
    color:         '#33334a',
    fontSize:      11,
    textAlign:     'center',
    marginTop:     16,
    lineHeight:    16,
    paddingHorizontal: 8,
  },

  // ── Confirm state ───────────────────────────────────────────────────────────
  confirmContainer: {
    flex:              1,
    backgroundColor:   '#0a0a0f',
    justifyContent:    'center',
    alignItems:        'center',
    padding:           32,
    gap:               12,
  },
  confirmIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: '#00d4ff18',
    borderWidth:     1,
    borderColor:     '#00d4ff44',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    8,
  },
  confirmIconText: { fontSize: 32 },
  confirmTitle: {
    color:      '#ffffff',
    fontSize:   22,
    fontWeight: '700',
    textAlign:  'center',
  },
  confirmBody: {
    color:      '#555566',
    fontSize:   14,
    textAlign:  'center',
    lineHeight: 20,
  },
  confirmedEmail: {
    color:      '#00d4ff',
    fontSize:   15,
    fontWeight: '600',
    textAlign:  'center',
  },
});

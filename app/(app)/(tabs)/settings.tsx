import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { Platform as RNPlatform } from 'react-native';
import { supabase }  from '@/lib/supabase';
import { useAuth }   from '@/hooks/useAuth';
import { useTheme, ACCENT_OPTIONS, type AccentColor } from '@/context/ThemeContext';
import {
  registerForPushNotifications,
  savePushToken,
  DEFAULT_NOTIF_PREFS,
  type NotifPrefs,
} from '@/lib/notifications';
import type { Role } from '@/types/auth';

const ROLE_COLOR: Record<Role, string> = {
  operator: '#FFD700',
  observer: '#ff8c00',
};

const REPO_URL = 'https://github.com/multiagentautomationsystems/mads-flight-commander';

// ── Storage helper for notif prefs ────────────────────────────────────────────

const NOTIF_STORAGE_KEY = 'notif_prefs';

async function loadNotifPrefs(): Promise<NotifPrefs> {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
      return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIF_PREFS;
    } catch { return DEFAULT_NOTIF_PREFS; }
  }
  try {
    const AS = await import('@react-native-async-storage/async-storage');
    const raw = await AS.default.getItem(NOTIF_STORAGE_KEY);
    return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIF_PREFS;
  } catch { return DEFAULT_NOTIF_PREFS; }
}

async function saveNotifPrefs(prefs: NotifPrefs) {
  const v = JSON.stringify(prefs);
  if (Platform.OS === 'web') {
    try { localStorage.setItem(NOTIF_STORAGE_KEY, v); } catch { /* ignore */ }
    return;
  }
  try {
    const AS = await import('@react-native-async-storage/async-storage');
    await AS.default.setItem(NOTIF_STORAGE_KEY, v);
  } catch { /* ignore */ }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function SettingsRow({
  label, value, onPress, danger, rightElement,
}: {
  label:        string;
  value?:       string;
  onPress?:     () => void;
  danger?:      boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
          {onPress ? (
            <Ionicons name="chevron-forward" size={14} color="#44445a" style={{ marginLeft: 4 }} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { session, profile, loading } = useAuth();
  const { accentColor, isDarkMode, setAccentColor, setDarkMode } = useTheme();

  const [signingOut,   setSigningOut]   = useState(false);
  const [displayName,  setDisplayName]  = useState('');
  const [editingName,  setEditingName]  = useState(false);
  const [savingName,   setSavingName]   = useState(false);
  const [notifPrefs,   setNotifPrefs]   = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [notifLoaded,  setNotifLoaded]  = useState(false);

  const email       = profile?.email ?? session?.user?.email ?? '';
  const role        = profile?.role ?? null;
  const roleColor   = role ? ROLE_COLOR[role] : '#555566';
  const initial     = ((profile?.displayName ?? email)?.[0] ?? '?').toUpperCase();

  // Sync display name from profile
  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  // Load notification prefs
  useEffect(() => {
    loadNotifPrefs().then(p => { setNotifPrefs(p); setNotifLoaded(true); });
  }, []);

  async function saveDisplayName() {
    if (!session?.user?.id || displayName.trim() === profile?.displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', session.user.id);
    setSavingName(false);
    setEditingName(false);
  }

  async function toggleNotif(key: keyof NotifPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await saveNotifPrefs(updated);
  }

  async function handleRegisterPush() {
    const token = await registerForPushNotifications();
    if (token) {
      await savePushToken(token);
      Alert.alert('Push Notifications', 'Registered successfully.');
    } else {
      Alert.alert('Push Notifications', 'Permission denied or not available on this platform.');
    }
  }

  async function confirmSignOut() {
    if (RNPlatform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign Out',
      'You will need to sign in again to continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
          },
        },
      ],
    );
  }

  function openLink(url: string) {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Alert.alert('Open Link', `Visit:\n${url}`);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, {
          backgroundColor: roleColor + '1a',
          borderColor:     roleColor + '44',
        }]}>
          <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
        </View>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              returnKeyType="done"
              blurOnSubmit
              onBlur={saveDisplayName}
              onSubmitEditing={saveDisplayName}
              placeholderTextColor="#44445a"
              placeholder="Display name"
            />
            {savingName
              ? <ActivityIndicator size="small" color={accentColor} style={{ marginLeft: 8 }} />
              : null}
          </View>
        ) : (
          <Pressable onPress={() => setEditingName(true)} style={styles.nameBtn}>
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName || email || '—'}
            </Text>
            <Ionicons name="pencil-outline" size={13} color="#44445a" style={{ marginLeft: 6 }} />
          </Pressable>
        )}

        {email && displayName ? (
          <Text style={styles.emailText}>{email}</Text>
        ) : null}

        {role && (
          <View style={[styles.roleBadge, {
            backgroundColor: roleColor + '1a',
            borderColor:     roleColor + '55',
          }]}>
            <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>
              {role.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* ── Appearance ────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="APPEARANCE" />
        <View style={styles.card}>
          <SettingsRow
            label="Dark Mode"
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#1e1e38', true: accentColor + '55' }}
                thumbColor={isDarkMode ? accentColor : '#44445a'}
              />
            }
          />
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Accent Color</Text>
            <View style={styles.accentRow}>
              {ACCENT_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={async () => {
                    if (RNPlatform.OS !== 'web') await Haptics.selectionAsync();
                    setAccentColor(opt.value as AccentColor);
                  }}
                  style={[
                    styles.accentDot,
                    { backgroundColor: opt.value },
                    accentColor === opt.value && styles.accentDotActive,
                  ]}
                  accessibilityLabel={`${opt.label} accent`}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      {notifLoaded && (
        <View style={styles.section}>
          <SectionTitle text="NOTIFICATIONS" />
          <View style={styles.card}>
            <SettingsRow
              label="Low Battery Alert  (< 20%)"
              rightElement={
                <Switch
                  value={notifPrefs.lowBattery}
                  onValueChange={v => toggleNotif('lowBattery', v)}
                  trackColor={{ false: '#1e1e38', true: accentColor + '55' }}
                  thumbColor={notifPrefs.lowBattery ? accentColor : '#44445a'}
                />
              }
            />
            <Divider />
            <SettingsRow
              label="Drone Error Alert"
              rightElement={
                <Switch
                  value={notifPrefs.droneError}
                  onValueChange={v => toggleNotif('droneError', v)}
                  trackColor={{ false: '#1e1e38', true: accentColor + '55' }}
                  thumbColor={notifPrefs.droneError ? accentColor : '#44445a'}
                />
              }
            />
            <Divider />
            <SettingsRow
              label="Drone Offline Alert"
              rightElement={
                <Switch
                  value={notifPrefs.droneOffline}
                  onValueChange={v => toggleNotif('droneOffline', v)}
                  trackColor={{ false: '#1e1e38', true: accentColor + '55' }}
                  thumbColor={notifPrefs.droneOffline ? accentColor : '#44445a'}
                />
              }
            />
            <Divider />
            <SettingsRow
              label="Mission Complete Alert"
              rightElement={
                <Switch
                  value={notifPrefs.missionDone}
                  onValueChange={v => toggleNotif('missionDone', v)}
                  trackColor={{ false: '#1e1e38', true: accentColor + '55' }}
                  thumbColor={notifPrefs.missionDone ? accentColor : '#44445a'}
                />
              }
            />
            <Divider />
            <SettingsRow
              label="Register Push Notifications"
              onPress={handleRegisterPush}
            />
          </View>
        </View>
      )}

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="ACCOUNT" />
        <View style={styles.card}>
          <SettingsRow label="Email"  value={email || '—'} />
          <Divider />
          <SettingsRow label="Role"   value={role ? role.charAt(0).toUpperCase() + role.slice(1) : '—'} />
          <Divider />
          <SettingsRow
            label="User ID"
            value={session?.user?.id ? session.user.id.slice(0, 18) + '…' : '—'}
          />
        </View>
      </View>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="ABOUT" />
        <View style={styles.card}>
          <SettingsRow
            label="Version"
            value={Application.nativeApplicationVersion ?? '0.1.0'}
          />
          <Divider />
          <SettingsRow label="App" value="MADS Flight Commander" />
          <Divider />
          <SettingsRow
            label="View on GitHub"
            onPress={() => openLink(REPO_URL)}
          />
          <Divider />
          <SettingsRow
            label="Contact Support"
            onPress={() => openLink('mailto:network-address@multiagentautomationsystems.com')}
          />
        </View>
      </View>

      {/* ── Danger Zone ───────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="DANGER ZONE" />
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={confirmSignOut}
            disabled={signingOut}
          >
            {signingOut
              ? <ActivityIndicator color="#ff4444" />
              : <Text style={styles.rowLabelDanger}>Sign Out</Text>}
          </Pressable>
          <Divider />
          <SettingsRow
            label="Delete Account"
            danger
            onPress={() =>
              Alert.alert(
                'Delete Account',
                'To delete your account, please contact support at network-address@multiagentautomationsystems.com. Your data will be permanently removed within 7 days.',
                [{ text: 'OK' }],
              )
            }
          />
        </View>
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  scroll:    { padding: 20, paddingBottom: 48, gap: 16 },

  // Profile card
  profileCard: {
    alignItems:        'center',
    backgroundColor:   SURFACE,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       BORDER,
    paddingVertical:   28,
    paddingHorizontal: 20,
    gap:               10,
  },
  avatar: {
    width:          72,
    height:         72,
    borderRadius:   36,
    borderWidth:    2,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   2,
  },
  avatarInitial: { fontSize: 28, fontWeight: '700' },
  nameBtn:       { flexDirection: 'row', alignItems: 'center' },
  nameEditRow:   { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    color:           '#ffffff',
    fontSize:        18,
    fontWeight:      '700',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
    minWidth:        120,
    textAlign:       'center',
    paddingVertical: 2,
  },
  displayName: { color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emailText:   { color: '#888899', fontSize: 12, textAlign: 'center' },
  roleBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    borderRadius:      20,
    borderWidth:       1,
    paddingHorizontal: 12,
    paddingVertical:   6,
    marginTop:         4,
  },
  roleDot:      { width: 6, height: 6, borderRadius: 3 },
  roleBadgeText:{ fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Section
  section:      { gap: 8 },
  sectionTitle: {
    color:             '#44445a',
    fontSize:          9,
    fontWeight:        '700',
    letterSpacing:     1.4,
    paddingHorizontal: 4,
  },

  // Card
  card: {
    backgroundColor: SURFACE,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     BORDER,
    overflow:        'hidden',
  },

  // Row
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  rowPressed: { backgroundColor: '#ffffff08' },
  rowLabel:   { color: '#c0c0d8', fontSize: 14 },
  rowLabelDanger: { color: '#ff4444', fontSize: 14 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: {
    color:      '#555566',
    fontSize:   13,
    maxWidth:   180,
    textAlign:  'right',
    marginRight: 4,
  },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 0 },

  // Accent color picker
  accentRow: { flexDirection: 'row', gap: 8 },
  accentDot: {
    width:        24,
    height:       24,
    borderRadius: 12,
    borderWidth:  2,
    borderColor:  'transparent',
  },
  accentDotActive: {
    borderColor: '#ffffff',
    transform:   [{ scale: 1.15 }],
  },
});

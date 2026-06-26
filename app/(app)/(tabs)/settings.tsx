import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types/auth';

const ROLE_COLOR: Record<Role, string> = {
  operator: '#FFD700',
  observer: '#ff8c00',
};

const ROLE_LABEL: Record<Role, string> = {
  operator: 'OPERATOR',
  observer: 'OBSERVER',
};

const ROLE_DESC: Record<Role, string> = {
  operator: 'Full control — arm/disarm drones, send missions, manage swarm groups, and configure the fleet.',
  observer: 'Read-only access — view live map, telemetry, mission status, and swarm groups.',
};

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { session, profile, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FFD700" />
      </View>
    );
  }

  const email       = profile?.email ?? session?.user?.email ?? '';
  const displayName = profile?.displayName?.trim() || null;
  const role        = profile?.role ?? null;
  const memberSince = profile?.createdAt ?? session?.user?.created_at ?? null;
  const initial     = (displayName?.[0] ?? email[0] ?? '?').toUpperCase();
  const roleColor   = role ? ROLE_COLOR[role] : '#555566';

  function confirmSignOut() {
    Alert.alert(
      'Sign Out',
      'You will need to sign in again to continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            // Auth guard in app/(app)/_layout.tsx handles the redirect to /login
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: roleColor + '1a', borderColor: roleColor + '44' }]}>
          <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
        </View>

        {/* Name + email */}
        {displayName && <Text style={styles.displayName}>{displayName}</Text>}
        <Text style={[styles.emailText, displayName ? styles.emailTextSmall : undefined]}>
          {email}
        </Text>

        {/* Role badge */}
        {role && (
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '1a', borderColor: roleColor + '55' }]}>
            <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>{ROLE_LABEL[role]}</Text>
          </View>
        )}
      </View>

      {/* ── Role description ──────────────────────────────────────────────── */}
      {role && (
        <View style={[styles.roleDescCard, { borderLeftColor: roleColor }]}>
          <Text style={styles.roleDescText}>{ROLE_DESC[role]}</Text>
        </View>
      )}

      {/* ── Account info ──────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="ACCOUNT" />
        <View style={styles.infoCard}>
          <InfoRow label="Email"        value={email || '—'} />
          <InfoRow
            label="Role"
            value={role ? (role.charAt(0).toUpperCase() + role.slice(1)) : '—'}
          />
          {memberSince && (
            <InfoRow label="Member since" value={fmtMonth(memberSince)} />
          )}
        </View>
      </View>

      {/* ── Session ───────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <SectionTitle text="SESSION" />
        <View style={styles.infoCard}>
          <InfoRow
            label="User ID"
            value={session?.user?.id?.slice(0, 16).concat('…') ?? '—'}
          />
        </View>
      </View>

      {/* ── Sign out ──────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Pressable
          style={[styles.signOutBtn, signingOut && styles.signOutBtnBusy]}
          onPress={confirmSignOut}
          disabled={signingOut}
        >
          {signingOut
            ? <ActivityIndicator color="#ff4444" />
            : <Text style={styles.signOutBtnText}>Sign Out</Text>
          }
        </Pressable>
      </View>
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
    alignItems:      'center',
    backgroundColor: SURFACE,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     BORDER,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap:             10,
  },
  avatar: {
    width:         72,
    height:        72,
    borderRadius:  36,
    borderWidth:   2,
    justifyContent: 'center',
    alignItems:    'center',
    marginBottom:  2,
  },
  avatarInitial: { fontSize: 28, fontWeight: '700' },
  displayName:   { color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emailText:     { color: '#888899', fontSize: 14, textAlign: 'center' },
  emailTextSmall:{ fontSize: 12 },

  // Role badge
  roleBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    borderRadius:    20,
    borderWidth:     1,
    paddingHorizontal: 12,
    paddingVertical:   6,
    marginTop:       4,
  },
  roleDot:      { width: 6, height: 6, borderRadius: 3 },
  roleBadgeText:{ fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Role description
  roleDescCard: {
    backgroundColor: SURFACE,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     BORDER,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roleDescText: { color: '#666677', fontSize: 13, lineHeight: 18 },

  // Section
  section:      { gap: 8 },
  sectionTitle: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.4,
    paddingHorizontal: 4,
  },

  // Info card
  infoCard: {
    backgroundColor: SURFACE,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     BORDER,
    overflow:        'hidden',
  },
  infoRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoLabel: { color: '#555566', fontSize: 14 },
  infoValue: {
    color:      '#c0c0d8',
    fontSize:   14,
    fontWeight: '500',
    maxWidth:   '60%',
    textAlign:  'right',
  },

  // Sign out
  signOutBtn: {
    backgroundColor: '#ff444415',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     '#ff444433',
    paddingVertical: 15,
    alignItems:      'center',
  },
  signOutBtnBusy:  { opacity: 0.6 },
  signOutBtnText:  { color: '#ff4444', fontWeight: '700', fontSize: 15 },
});

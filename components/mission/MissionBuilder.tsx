// Web fallback — @rnmapbox/maps is native-only.
// Allows creating a named draft mission with drone assignment; waypoints must be added on native.
import { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Alert, StyleSheet,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useAuth } from '@/hooks/useAuth';

export default function MissionBuilder() {
  const { session, profile } = useAuth();
  const allDrones = useDroneStream();
  const isOperator = profile?.role === 'operator';

  const [name, setName]           = useState('');
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving, setSaving]       = useState(false);

  function toggleDrone(droneId: string) {
    setAssignedIds(prev =>
      prev.includes(droneId) ? prev.filter(id => id !== droneId) : [...prev, droneId]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a mission name before saving.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('missions')
      .insert({
        name:              name.trim(),
        status:            'draft',
        waypoints:         [],
        assigned_drone_ids: assignedIds,
        assigned_group_id:  null,
        created_by:         session!.user.id,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.replace(`/(app)/mission/${data.id}`);
  }

  if (!isOperator) {
    return (
      <View style={styles.centered}>
        <Text style={styles.accessDenied}>
          Observer mode — mission creation is restricted to operators.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'New Mission' }} />

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Waypoint planning is available on iOS/Android.{'\n'}
          You can create a named draft mission here and add waypoints on device.
        </Text>
      </View>

      {/* Mission name */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>MISSION NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter mission name…"
          placeholderTextColor="#44445a"
          maxLength={80}
        />
      </View>

      {/* Drone assignment */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          ASSIGN DRONES{assignedIds.length > 0 ? `  (${assignedIds.length} selected)` : ''}
        </Text>
        {allDrones.length === 0 ? (
          <Text style={styles.emptyText}>No drones online</Text>
        ) : (
          <View style={styles.droneGrid}>
            {allDrones.map(drone => {
              const sel = assignedIds.includes(drone.id);
              return (
                <Pressable
                  key={drone.id}
                  style={[styles.droneChip, sel && styles.droneChipSel]}
                  onPress={() => toggleDrone(drone.id)}
                >
                  <Text style={[styles.droneChipText, sel && styles.droneChipTextSel]}>
                    {drone.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Creating…' : 'Create Draft Mission'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0f' },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#0a0a0f' },
  accessDenied: { color: '#555566', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  scroll:       { padding: 16, gap: 20, paddingBottom: 40 },

  banner: {
    backgroundColor: '#1a1a2e',
    borderRadius:    8,
    padding:         12,
    borderWidth:     1,
    borderColor:     '#2a2a4e',
  },
  bannerText: { color: '#555566', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  field:      { gap: 8 },
  fieldLabel: { color: '#44445a', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },

  input: {
    backgroundColor: SURFACE,
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color:           '#fff',
    fontSize:        15,
  },

  droneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  droneChip: {
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     '#2a2a4e',
    paddingHorizontal: 14,
    paddingVertical:   8,
    backgroundColor: SURFACE,
  },
  droneChipSel:     { borderColor: '#FFD70088', backgroundColor: '#FFD70018' },
  droneChipText:    { color: '#666677', fontSize: 13 },
  droneChipTextSel: { color: '#FFD700', fontWeight: '600' },
  emptyText:        { color: '#33334a', fontSize: 13 },

  saveBtn:         { backgroundColor: '#FFD700', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#000', fontSize: 15, fontWeight: '700' },
});

import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useDroneStream } from '@/hooks/useDroneStream';
import { useMissions } from '@/hooks/useMissions';
import type { DroneGroup, DroneStatus } from '@/types/drone';
import type { Mission, MissionStatus } from '@/types/mission';

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  '#00d4ff', '#ff8c00', '#00e676', '#a020f0',
  '#ff4444', '#ffd700', '#ff69b4', '#aaaaaa',
];

const DRONE_STATUS_COLOR: Record<DroneStatus, string> = {
  idle:      '#666677',
  armed:     '#ff8c00',
  flying:    '#00d4ff',
  returning: '#a020f0',
  error:     '#ff4444',
  offline:   '#333344',
};

const DRONE_STATUS_LABEL: Record<DroneStatus, string> = {
  idle:      'IDLE',
  armed:     'ARMED',
  flying:    'FLYING',
  returning: 'RTH',
  error:     'ERROR',
  offline:   'OFFLINE',
};

const MISSION_STATUS_COLOR: Record<MissionStatus, string> = {
  draft:     '#555566',
  uploaded:  '#ff8c00',
  active:    '#00d4ff',
  paused:    '#a020f0',
  completed: '#00e676',
  aborted:   '#ff4444',
};

const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  draft:     'DRAFT',
  uploaded:  'READY',
  active:    'ACTIVE',
  paused:    'PAUSED',
  completed: 'DONE',
  aborted:   'ABORTED',
};

// ── Sheet type ────────────────────────────────────────────────────────────────

type Sheet =
  | { type: 'new_group' }
  | { type: 'edit_members';   group: DroneGroup }
  | { type: 'assign_mission'; group: DroneGroup };

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SwarmScreen() {
  const { session, profile } = useAuth();
  const groups   = useGroups();
  const drones   = useDroneStream();
  const missions = useMissions();
  const isOperator = profile?.role === 'operator';

  const [sheet, setSheet] = useState<Sheet | null>(null);

  // Only show missions that can still be acted upon
  const assignableMissions = missions.filter(
    m => m.status !== 'completed' && m.status !== 'aborted'
  );

  // ── Mutation handlers ──────────────────────────────────────────────────────

  async function handleCreateGroup(name: string, color: string) {
    await supabase.from('drone_groups').insert({
      name:       name.trim(),
      color,
      created_by: session!.user.id,
    });
    setSheet(null);
  }

  function handleDeleteGroup(group: DroneGroup) {
    Alert.alert(
      `Delete "${group.name}"?`,
      'Drones in this group will be unassigned. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => supabase.from('drone_groups').delete().eq('id', group.id),
        },
      ]
    );
  }

  async function handleSaveMembers(groupId: string, toAdd: string[], toRemove: string[]) {
    const ops: Promise<unknown>[] = [];
    if (toAdd.length > 0)
      ops.push(supabase.from('drones').update({ group_id: groupId }).in('id', toAdd));
    if (toRemove.length > 0)
      ops.push(supabase.from('drones').update({ group_id: null }).in('id', toRemove));
    await Promise.all(ops);
    setSheet(null);
  }

  async function handleAssignMission(missionId: string, groupId: string) {
    const groupDroneIds = drones
      .filter(d => d.groupId === groupId)
      .map(d => d.id);
    await supabase.from('missions').update({
      assigned_group_id:  groupId,
      assigned_drone_ids: groupDroneIds,
    }).eq('id', missionId);
  }

  async function handleUnassignMission(missionId: string) {
    await supabase.from('missions').update({
      assigned_group_id:  null,
      assigned_drone_ids: [],
    }).eq('id', missionId);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {!isOperator && <ObserverBanner />}

      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            drones={drones.filter(d => d.groupId === item.id)}
            mission={missions.find(m => m.assignedGroupId === item.id) ?? null}
            isOperator={isOperator}
            onEditMembers={() => setSheet({ type: 'edit_members',   group: item })}
            onAssignMission={() => setSheet({ type: 'assign_mission', group: item })}
            onDelete={() => handleDeleteGroup(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <EmptyState
            isOperator={isOperator}
            onCreateGroup={() => setSheet({ type: 'new_group' })}
          />
        }
      />

      {isOperator && (
        <Pressable style={styles.fab} onPress={() => setSheet({ type: 'new_group' })}>
          <Text style={styles.fabText}>+ New Group</Text>
        </Pressable>
      )}

      {/* ── Modals (conditionally rendered so state resets on close) ── */}
      {sheet?.type === 'new_group' && (
        <NewGroupSheet
          onClose={() => setSheet(null)}
          onSave={handleCreateGroup}
        />
      )}
      {sheet?.type === 'edit_members' && (
        <EditMembersSheet
          group={sheet.group}
          allDrones={drones}
          groups={groups}
          onClose={() => setSheet(null)}
          onSave={handleSaveMembers}
        />
      )}
      {sheet?.type === 'assign_mission' && (
        <AssignMissionSheet
          group={sheet.group}
          missions={assignableMissions}
          onClose={() => setSheet(null)}
          onAssign={handleAssignMission}
          onUnassign={handleUnassignMission}
        />
      )}
    </View>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

type GroupCardProps = {
  group:          DroneGroup;
  drones:         ReturnType<typeof useDroneStream>;
  mission:        Mission | null;
  isOperator:     boolean;
  onEditMembers:  () => void;
  onAssignMission:() => void;
  onDelete:       () => void;
};

function GroupCard({ group, drones, mission, isOperator, onEditMembers, onAssignMission, onDelete }: GroupCardProps) {
  const sc = group.color;

  return (
    <View style={[styles.card, { borderLeftColor: sc }]}>

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.groupDot, { backgroundColor: sc }]} />
          <Text style={styles.groupName}>{group.name}</Text>
        </View>
        <Text style={styles.droneCount}>
          {drones.length} drone{drones.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Drone list */}
      {drones.length > 0 ? (
        <View style={styles.droneList}>
          {drones.map(d => (
            <View key={d.id} style={styles.droneRow}>
              <View style={[styles.droneDot, { backgroundColor: DRONE_STATUS_COLOR[d.status] }]} />
              <Text style={styles.droneRowName} numberOfLines={1}>{d.name}</Text>
              <Text style={[styles.droneRowStatus, { color: DRONE_STATUS_COLOR[d.status] }]}>
                {DRONE_STATUS_LABEL[d.status]}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noDrones}>No drones assigned to this group</Text>
      )}

      {/* Mission badge */}
      <View style={[styles.missionRow, { borderTopColor: '#1e1e38' }]}>
        {mission ? (
          <>
            <Text style={styles.missionRowLabel}>MISSION</Text>
            <Text style={styles.missionRowName} numberOfLines={1}>{mission.name}</Text>
            <View style={[
              styles.missionBadge,
              {
                backgroundColor: MISSION_STATUS_COLOR[mission.status] + '22',
                borderColor:     MISSION_STATUS_COLOR[mission.status] + '66',
              },
            ]}>
              <Text style={[styles.missionBadgeText, { color: MISSION_STATUS_COLOR[mission.status] }]}>
                {MISSION_STATUS_LABEL[mission.status]}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.noMission}>No mission assigned</Text>
        )}
      </View>

      {/* Operator controls */}
      {isOperator && (
        <View style={styles.controls}>
          <ControlButton label="Members"    color="#00d4ff" onPress={onEditMembers} />
          <ControlButton label="Mission"    color="#ff8c00" onPress={onAssignMission} />
          <ControlButton label="Delete"     color="#ff4444" onPress={onDelete} />
        </View>
      )}
    </View>
  );
}

// ── NewGroupSheet ──────────────────────────────────────────────────────────────

function NewGroupSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave:  (name: string, color: string) => Promise<void>;
}) {
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name, color);
    // parent closes the sheet; no need to reset (component unmounts)
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <SheetHandle />
          <Text style={styles.sheetTitle}>New Group</Text>

          <Text style={styles.sheetLabel}>GROUP NAME</Text>
          <TextInput
            style={styles.sheetInput}
            value={name}
            onChangeText={setName}
            placeholder="Enter group name…"
            placeholderTextColor="#44445a"
            autoFocus
            maxLength={60}
            returnKeyType="done"
          />

          <Text style={[styles.sheetLabel, { marginTop: 16 }]}>COLOR</Text>
          <View style={styles.colorPicker}>
            {GROUP_COLORS.map(c => (
              <Pressable
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSel]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {/* Preview strip */}
          <View style={[styles.colorPreview, { backgroundColor: color + '18', borderColor: color + '66' }]}>
            <View style={[styles.groupDot, { backgroundColor: color }]} />
            <Text style={[styles.colorPreviewName, { color }]}>
              {name.trim() || 'Group Name'}
            </Text>
          </View>

          <Pressable
            style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Creating…' : 'Create Group'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── EditMembersSheet ───────────────────────────────────────────────────────────

function EditMembersSheet({
  group,
  allDrones,
  groups,
  onClose,
  onSave,
}: {
  group:     DroneGroup;
  allDrones: ReturnType<typeof useDroneStream>;
  groups:    DroneGroup[];
  onClose:   () => void;
  onSave:    (groupId: string, toAdd: string[], toRemove: string[]) => Promise<void>;
}) {
  // Snapshot current group members on mount — component unmounts on close so this is fresh each open
  const [pending, setPending] = useState<Set<string>>(
    () => new Set(allDrones.filter(d => d.groupId === group.id).map(d => d.id))
  );
  const [saving, setSaving] = useState(false);

  const initialIds = new Set(allDrones.filter(d => d.groupId === group.id).map(d => d.id));

  function toggle(droneId: string) {
    setPending(prev => {
      const next = new Set(prev);
      next.has(droneId) ? next.delete(droneId) : next.add(droneId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const toAdd    = [...pending].filter(id => !initialIds.has(id));
    const toRemove = [...initialIds].filter(id => !pending.has(id));
    await onSave(group.id, toAdd, toRemove);
  }

  const hasChanges =
    [...pending].some(id => !initialIds.has(id)) ||
    [...initialIds].some(id => !pending.has(id));

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000088' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: '72%' }]}>
          <SheetHandle />
          <Text style={styles.sheetTitle}>Members of {group.name}</Text>
          <Text style={styles.sheetSubtitle}>
            Toggle drones to add or remove them from this group.
          </Text>

          <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
            {allDrones.length === 0 ? (
              <Text style={styles.sheetEmpty}>No drones in the fleet yet</Text>
            ) : (
              allDrones.map(drone => {
                const isMember   = pending.has(drone.id);
                const otherGroup = drone.groupId && drone.groupId !== group.id
                  ? groups.find(g => g.id === drone.groupId)
                  : null;

                return (
                  <Pressable key={drone.id} style={styles.memberItem} onPress={() => toggle(drone.id)}>
                    <View style={[styles.checkbox, isMember && styles.checkboxChecked]}>
                      {isMember && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{drone.name}</Text>
                      {otherGroup && (
                        <Text style={styles.memberOtherGroup}>
                          Currently in {otherGroup.name} — will move
                        </Text>
                      )}
                    </View>
                    <View style={[styles.memberStatusDot, { backgroundColor: DRONE_STATUS_COLOR[drone.status] }]} />
                    <Text style={[styles.memberStatus, { color: DRONE_STATUS_COLOR[drone.status] }]}>
                      {DRONE_STATUS_LABEL[drone.status]}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── AssignMissionSheet ─────────────────────────────────────────────────────────

function AssignMissionSheet({
  group,
  missions,
  onClose,
  onAssign,
  onUnassign,
}: {
  group:      DroneGroup;
  missions:   Mission[];
  onClose:    () => void;
  onAssign:   (missionId: string, groupId: string) => Promise<void>;
  onUnassign: (missionId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const assignedMission = missions.find(m => m.assignedGroupId === group.id);

  async function handleTap(mission: Mission) {
    if (busy) return;
    setBusy(true);
    if (mission.assignedGroupId === group.id) {
      await onUnassign(mission.id);
    } else {
      await onAssign(mission.id, group.id);
    }
    setBusy(false);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000088' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: '72%' }]}>
          <SheetHandle />
          <Text style={styles.sheetTitle}>Assign Mission</Text>
          <Text style={styles.sheetSubtitle}>
            {assignedMission
              ? `Currently: ${assignedMission.name} — tap to change or unassign.`
              : `Tap a mission to assign it to ${group.name}.`}
          </Text>

          <ScrollView style={{ marginTop: 8 }}>
            {missions.length === 0 ? (
              <Text style={styles.sheetEmpty}>No missions available to assign</Text>
            ) : (
              missions.map(mission => {
                const sc         = MISSION_STATUS_COLOR[mission.status];
                const isAssigned = mission.assignedGroupId === group.id;

                return (
                  <Pressable
                    key={mission.id}
                    style={[styles.missionItem, isAssigned && styles.missionItemAssigned]}
                    onPress={() => handleTap(mission)}
                    disabled={busy}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.missionItemName}>{mission.name}</Text>
                      <Text style={styles.missionItemMeta}>
                        {mission.waypoints.length} waypoint{mission.waypoints.length !== 1 ? 's' : ''}
                        {mission.assignedGroupId && !isAssigned ? '  ·  assigned to another group' : ''}
                      </Text>
                    </View>
                    <View style={[styles.missionItemBadge, { backgroundColor: sc + '22', borderColor: sc + '66' }]}>
                      <Text style={[styles.missionItemBadgeText, { color: sc }]}>
                        {MISSION_STATUS_LABEL[mission.status]}
                      </Text>
                    </View>
                    {isAssigned && <Text style={styles.assignedCheck}>✓</Text>}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function SheetHandle() {
  return (
    <View style={{ alignItems: 'center', paddingBottom: 14 }}>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#2a2a4e' }} />
    </View>
  );
}

function ControlButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.controlBtn, { borderColor: color + '66', backgroundColor: color + '12' }]}
      onPress={onPress}
    >
      <Text style={[styles.controlBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function ObserverBanner() {
  return (
    <View style={styles.observerBanner}>
      <Text style={styles.observerText}>Observer mode — read only</Text>
    </View>
  );
}

function EmptyState({ isOperator, onCreateGroup }: { isOperator: boolean; onCreateGroup: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No swarm groups</Text>
      <Text style={styles.emptyHint}>
        {isOperator
          ? 'Create a group to coordinate multiple drones as a swarm and assign missions to them at once.'
          : 'No swarm groups have been configured yet.'}
      </Text>
      {isOperator && (
        <Pressable style={styles.emptyBtn} onPress={onCreateGroup}>
          <Text style={styles.emptyBtnText}>Create First Group</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BORDER  = '#1e1e38';
const SURFACE = '#0f0f1e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  // Observer banner
  observerBanner: {
    backgroundColor: '#1a1420',
    borderBottomWidth: 1,
    borderBottomColor: '#ff8c0033',
    paddingVertical: 8,
    alignItems: 'center',
  },
  observerText: { color: '#ff8c00', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  // List
  list: { padding: 16, paddingBottom: 100 },

  // Group card
  card: {
    backgroundColor: SURFACE,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     BORDER,
    borderLeftWidth: 3,
    overflow:        'hidden',
  },
  cardHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 14,
    paddingTop:      13,
    paddingBottom:   11,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupDot:       { width: 10, height: 10, borderRadius: 5 },
  groupName:      { color: '#ffffff', fontSize: 15, fontWeight: '700', flex: 1 },
  droneCount:     { color: '#555566', fontSize: 12 },

  // Drone list inside card
  droneList: {
    paddingHorizontal: 14,
    paddingBottom:     11,
    gap:               6,
    borderTopWidth:    1,
    borderTopColor:    BORDER,
    paddingTop:        10,
  },
  droneRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  droneDot:       { width: 6, height: 6, borderRadius: 3 },
  droneRowName:   { color: '#9090a8', fontSize: 13, flex: 1 },
  droneRowStatus: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  noDrones:       { color: '#33334a', fontSize: 12, paddingHorizontal: 14, paddingBottom: 11, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },

  // Mission row
  missionRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth:  1,
  },
  missionRowLabel: { color: '#44445a', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  missionRowName:  { color: '#c0c0d8', fontSize: 12, flex: 1 },
  missionBadge: {
    borderRadius:    5,
    borderWidth:     1,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  missionBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  noMission:        { color: '#33334a', fontSize: 12 },

  // Controls
  controls: {
    flexDirection:   'row',
    gap:             8,
    paddingHorizontal: 14,
    paddingBottom:   12,
    paddingTop:      10,
    borderTopWidth:  1,
    borderTopColor:  BORDER,
  },
  controlBtn: {
    flex:          1,
    borderRadius:  8,
    borderWidth:   1,
    paddingVertical: 8,
    alignItems:    'center',
  },
  controlBtnText: { fontSize: 12, fontWeight: '700' },

  // FAB
  fab: {
    position:          'absolute',
    bottom:            24,
    right:             24,
    backgroundColor:   '#00d4ff',
    borderRadius:      24,
    paddingVertical:   12,
    paddingHorizontal: 20,
  },
  fabText: { color: '#000', fontWeight: '700', fontSize: 14 },

  // Bottom sheet shared
  sheet: {
    backgroundColor:       '#12121f',
    borderTopLeftRadius:   20,
    borderTopRightRadius:  20,
    borderTopWidth:        1,
    borderTopColor:        BORDER,
    paddingHorizontal:     20,
    paddingTop:            16,
    paddingBottom:         32,
  },
  sheetTitle:    { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sheetSubtitle: { color: '#555566', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sheetLabel: {
    color:         '#44445a',
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
    marginBottom:  6,
  },
  sheetEmpty:    { color: '#33334a', fontSize: 13, paddingVertical: 20, textAlign: 'center' },
  sheetInput: {
    backgroundColor: '#0f0f1e',
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color:           '#fff',
    fontSize:        15,
    marginBottom:    4,
  },

  // Color picker
  colorPicker: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
    marginBottom:  16,
  },
  colorSwatch: {
    width:        36,
    height:       36,
    borderRadius: 18,
  },
  colorSwatchSel: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  colorPreview: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    borderRadius:    10,
    borderWidth:     1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom:    16,
  },
  colorPreviewName: { fontSize: 14, fontWeight: '700' },

  // Member items (EditMembersSheet)
  memberItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  checkbox: {
    width:        22,
    height:       22,
    borderRadius: 4,
    borderWidth:  1,
    borderColor:  '#2a2a4e',
    justifyContent: 'center',
    alignItems:   'center',
  },
  checkboxChecked: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  checkmark:       { color: '#000000', fontSize: 13, fontWeight: '800', lineHeight: 15 },
  memberInfo:      { flex: 1 },
  memberName:      { color: '#c0c0d8', fontSize: 13, fontWeight: '500' },
  memberOtherGroup:{ color: '#ff8c00', fontSize: 11, marginTop: 1 },
  memberStatusDot: { width: 6, height: 6, borderRadius: 3 },
  memberStatus:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, minWidth: 46 },

  // Mission items (AssignMissionSheet)
  missionItem: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  missionItemAssigned: { backgroundColor: '#00d4ff0a' },
  missionItemName:     { color: '#d0d0e8', fontSize: 14, fontWeight: '600' },
  missionItemMeta:     { color: '#44445a', fontSize: 11, marginTop: 2 },
  missionItemBadge: {
    borderRadius:    5,
    borderWidth:     1,
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  missionItemBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  assignedCheck:        { color: '#00d4ff', fontSize: 16, fontWeight: '700', marginLeft: 2 },

  // Save button (shared)
  saveBtn: {
    backgroundColor: '#00d4ff',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       16,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText:     { color: '#000', fontSize: 15, fontWeight: '700' },

  // Empty state
  empty: {
    marginTop:         80,
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 32,
  },
  emptyTitle: { color: '#555566', fontSize: 16, fontWeight: '600' },
  emptyHint:  { color: '#33334a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop:         8,
    backgroundColor:   '#00d4ff',
    borderRadius:      20,
    paddingVertical:   10,
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
});

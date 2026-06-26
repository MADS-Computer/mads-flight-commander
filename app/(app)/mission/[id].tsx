import { useLocalSearchParams } from 'expo-router';
// Metro picks MissionDetail.native.tsx on iOS/Android (MapboxGL map + waypoint markers)
// and MissionDetail.tsx on web (list-only fallback).
import MissionDetail from '@/components/mission/MissionDetail';

export default function MissionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MissionDetail missionId={id} />;
}

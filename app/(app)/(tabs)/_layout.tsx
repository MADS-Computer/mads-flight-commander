import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle:           { backgroundColor: '#0a0a0f', borderTopColor: '#1e1e38' },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#44445a',
        headerStyle:           { backgroundColor: '#0a0a0f' },
        headerTintColor:       '#ffffff',
        tabBarLabelStyle:      { fontSize: 10, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="map"       options={{ title: 'Map',       tabBarLabel: 'Map'       }} />
      <Tabs.Screen name="telemetry" options={{ title: 'Telemetry', tabBarLabel: 'Telemetry' }} />
      <Tabs.Screen name="missions"  options={{ title: 'Missions',  tabBarLabel: 'Missions'  }} />
      <Tabs.Screen name="swarm"     options={{ title: 'Swarm',     tabBarLabel: 'Swarm'     }} />
      <Tabs.Screen name="settings"  options={{ title: 'Settings',  tabBarLabel: 'Settings'  }} />
    </Tabs>
  );
}

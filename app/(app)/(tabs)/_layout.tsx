import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTheme } from '@/context/ThemeContext';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function icon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, size }: { color: string; size: number }) => (
    // Tabs passes `focused` via color already, but we still want outline vs filled
    // The `color` arg is already accentColor vs inactive — we just need the right glyph.
    // We expose both variants so the caller decides; here we infer from opacity isn't ideal,
    // so we accept both names and let Tabs.Screen options.tabBarIcon resolve focused.
    <Ionicons name={active} size={size} color={color} />
  );
}

export default function TabLayout() {
  const { accentColor } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle:             { backgroundColor: '#0a0a0f', borderTopColor: '#1e1e38' },
        tabBarActiveTintColor:   accentColor,
        tabBarInactiveTintColor: '#44445a',
        headerStyle:             { backgroundColor: '#0a0a0f' },
        headerTintColor:         '#ffffff',
        tabBarLabelStyle:        { fontSize: 10, fontWeight: '600', marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title:       'Map',
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="telemetry"
        options={{
          title:       'Telemetry',
          tabBarLabel: 'Telemetry',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title:       'Missions',
          tabBarLabel: 'Missions',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'navigate' : 'navigate-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swarm"
        options={{
          title:       'Swarm',
          tabBarLabel: 'Swarm',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title:       'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

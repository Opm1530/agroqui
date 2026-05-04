import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/colors'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: { borderTopColor: colors.gray[200] },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Nota Fiscal',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="entries"
        options={{
          title: 'Lançamentos',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: 'Preços',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

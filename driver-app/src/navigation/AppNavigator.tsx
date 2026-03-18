import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import RouteScreen from '../screens/RouteScreen';
import StopDetailScreen from '../screens/StopDetailScreen';
import CreateInvoiceScreen from '../screens/CreateInvoiceScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import PaymentScreen from '../screens/PaymentScreen';
import SignatureScreen from '../screens/SignatureScreen';
import TruckInventoryScreen from '../screens/TruckInventoryScreen';
import CreditMemoScreen from '../screens/CreditMemoScreen';
import DailySummaryScreen from '../screens/DailySummaryScreen';
import SyncScreen from '../screens/SyncScreen';
import InvoiceListScreen from '../screens/InvoiceListScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function RouteStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="RouteList" component={RouteScreen} options={{ title: 'Today\'s Route' }} />
      <Stack.Screen name="StopDetail" component={StopDetailScreen} options={{ title: 'Stop Details' }} />
      <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} options={{ title: 'New Invoice' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Invoice' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Collect Payment' }} />
      <Stack.Screen name="Signature" component={SignatureScreen} options={{ title: 'Signature' }} />
      <Stack.Screen name="CreditMemo" component={CreditMemoScreen} options={{ title: 'Credit / Return' }} />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="TruckInventory" component={TruckInventoryScreen} options={{ title: 'Truck Inventory' }} />
    </Stack.Navigator>
  );
}

function InvoicesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Invoice' }} />
    </Stack.Navigator>
  );
}

function SummaryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="DailySummary" component={DailySummaryScreen} options={{ title: 'Daily Summary' }} />
      <Stack.Screen name="Sync" component={SyncScreen} options={{ title: 'Sync' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#333' },
        tabBarActiveTintColor: '#4cc9f0',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          if (route.name === 'Route') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Inventory') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Invoices') iconName = focused ? 'document-text' : 'document-text-outline';
          else if (route.name === 'Summary') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Route" component={RouteStack} />
      <Tab.Screen name="Inventory" component={InventoryStack} />
      <Tab.Screen name="Invoices" component={InvoicesStack} />
      <Tab.Screen name="Summary" component={SummaryStack} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLogin={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

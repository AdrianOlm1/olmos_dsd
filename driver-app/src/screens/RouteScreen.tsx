import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalRoute, arriveAtStop, skipStop } from '../services/local-operations';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#888',
  IN_PROGRESS: '#f0a500',
  COMPLETED: '#00c853',
  SKIPPED: '#ff5252',
  NO_SERVICE: '#ff5252',
};

export default function RouteScreen({ navigation }: any) {
  const [route, setRoute] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadRoute = useCallback(async () => {
    const data = await getLocalRoute();
    setRoute(data);
  }, []);

  useEffect(() => {
    loadRoute();
    const unsubscribe = navigation.addListener('focus', loadRoute);
    return unsubscribe;
  }, [navigation, loadRoute]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoute();
    setRefreshing(false);
  };

  const handleStopPress = (stop: any) => {
    navigation.navigate('StopDetail', { stop, routeId: route?.id });
  };

  const renderStop = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.stopCard} onPress={() => handleStopPress(item)}>
      <View style={styles.stopHeader}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || '#888' }]} />
        <Text style={styles.stopOrder}>#{item.stop_order}</Text>
        <Text style={styles.customerName} numberOfLines={1}>{item.customer_name}</Text>
        <Ionicons name="chevron-forward" size={20} color="#888" />
      </View>
      <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
      <View style={styles.stopMeta}>
        <Text style={styles.stopStatus}>{item.status.replace('_', ' ')}</Text>
        {item.actual_arrival && (
          <Text style={styles.arrivalTime}>
            Arrived: {new Date(item.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!route) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={64} color="#444" />
        <Text style={styles.emptyText}>No route assigned for today</Text>
        <Text style={styles.emptySubtext}>Pull down to refresh or sync with server</Text>
      </View>
    );
  }

  const completed = route.stops?.filter((s: any) => s.status === 'COMPLETED').length || 0;
  const total = route.stops?.length || 0;

  return (
    <View style={styles.container}>
      <View style={styles.routeHeader}>
        <Text style={styles.routeName}>{route.name}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${total > 0 ? (completed / total) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.progressText}>{completed}/{total} stops completed</Text>
      </View>

      <FlatList
        data={route.stops || []}
        renderItem={renderStop}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4cc9f0" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  emptyContainer: { flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#555', fontSize: 14, marginTop: 8 },
  routeHeader: { padding: 16, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  routeName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  progressBar: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4cc9f0', borderRadius: 3 },
  progressText: { color: '#888', fontSize: 13, marginTop: 6 },
  list: { padding: 12 },
  stopCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#333',
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  stopOrder: { color: '#4cc9f0', fontWeight: 'bold', marginRight: 8, fontSize: 15 },
  customerName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  address: { color: '#888', fontSize: 13, marginLeft: 26 },
  stopMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginLeft: 26 },
  stopStatus: { color: '#888', fontSize: 12, textTransform: 'uppercase' },
  arrivalTime: { color: '#4cc9f0', fontSize: 12 },
});

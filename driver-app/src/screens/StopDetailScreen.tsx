import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { arriveAtStop, completeStop, skipStop, getCustomerInsights, logDeliveryEvent } from '../services/local-operations';
import * as Location from 'expo-location';

export default function StopDetailScreen({ navigation, route: navRoute }: any) {
  const { stop, routeId } = navRoute.params;
  const [status, setStatus] = useState(stop.status);
  const [insights, setInsights] = useState<any>(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    const data = await getCustomerInsights(stop.customer_id);
    if (data) setInsights(data);
  };

  const getCoords = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
    } catch {}
    return undefined;
  };

  const handleArrive = async () => {
    const coords = await getCoords();
    await arriveAtStop(stop.id);
    await logDeliveryEvent(stop.location_id, 'ARRIVED', null, coords);
    setStatus('IN_PROGRESS');
  };

  const handleComplete = async () => {
    const coords = await getCoords();
    await completeStop(stop.id, routeId);
    await logDeliveryEvent(stop.location_id, 'DEPARTED', null, coords);
    setStatus('COMPLETED');
    navigation.goBack();
  };

  const handleSkip = () => {
    Alert.prompt('Skip Stop', 'Reason for no service:', async (reason) => {
      if (reason) {
        await skipStop(stop.id, reason);
        await logDeliveryEvent(stop.location_id, 'NO_SERVICE', { reason });
        setStatus('NO_SERVICE');
        navigation.goBack();
      }
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.customerName}>{stop.customer_name}</Text>
        <Text style={styles.address}>{stop.address}</Text>
        {stop.receiving_hours_start && (
          <Text style={styles.hours}>
            Receiving: {stop.receiving_hours_start} - {stop.receiving_hours_end}
          </Text>
        )}
      </View>

      {/* Customer Insights */}
      {insights && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Insights</Text>
          <View style={styles.insightRow}>
            <View style={styles.insightItem}>
              <Text style={styles.insightValue}>${insights.avg_order_value?.toFixed(0) || '0'}</Text>
              <Text style={styles.insightLabel}>Avg Order</Text>
            </View>
            <View style={styles.insightItem}>
              <Text style={styles.insightValue}>{insights.order_count || 0}</Text>
              <Text style={styles.insightLabel}>Total Orders</Text>
            </View>
            <View style={styles.insightItem}>
              <Text style={[styles.insightValue, { color: (insights.churn_risk || 0) > 0.5 ? '#ff5252' : '#00c853' }]}>
                {((insights.churn_risk || 0) * 100).toFixed(0)}%
              </Text>
              <Text style={styles.insightLabel}>Churn Risk</Text>
            </View>
          </View>

          {insights.suggested_products && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>Suggested Products:</Text>
              {JSON.parse(insights.suggested_products || '[]').slice(0, 3).map((p: any, i: number) => (
                <Text key={i} style={styles.suggestionItem}>+ {p.name}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        {status === 'PENDING' && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4cc9f0' }]} onPress={handleArrive}>
            <Ionicons name="location" size={22} color="#1a1a2e" />
            <Text style={[styles.actionText, { color: '#1a1a2e' }]}>Arrive at Stop</Text>
          </TouchableOpacity>
        )}

        {status === 'IN_PROGRESS' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#00c853' }]}
              onPress={() => navigation.navigate('CreateInvoice', { customerId: stop.customer_id, locationId: stop.location_id, routeId, customerName: stop.customer_name })}
            >
              <Ionicons name="document-text" size={22} color="#fff" />
              <Text style={styles.actionText}>Create Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f0a500' }]}
              onPress={() => navigation.navigate('CreditMemo', { customerId: stop.customer_id, customerName: stop.customer_name })}
            >
              <Ionicons name="return-down-back" size={22} color="#fff" />
              <Text style={styles.actionText}>Credit / Return</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4cc9f0' }]} onPress={handleComplete}>
              <Ionicons name="checkmark-circle" size={22} color="#1a1a2e" />
              <Text style={[styles.actionText, { color: '#1a1a2e' }]}>Complete Stop</Text>
            </TouchableOpacity>
          </>
        )}

        {['PENDING', 'IN_PROGRESS'].includes(status) && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff5252' }]} onPress={handleSkip}>
            <Ionicons name="close-circle" size={22} color="#fff" />
            <Text style={styles.actionText}>Skip / No Service</Text>
          </TouchableOpacity>
        )}

        {status === 'COMPLETED' && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#00c853" />
            <Text style={styles.completedText}>Stop Completed</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  section: { backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  customerName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  address: { color: '#888', fontSize: 15, marginTop: 6 },
  hours: { color: '#4cc9f0', fontSize: 13, marginTop: 6 },
  sectionTitle: { color: '#4cc9f0', fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  insightRow: { flexDirection: 'row', justifyContent: 'space-around' },
  insightItem: { alignItems: 'center' },
  insightValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  insightLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  suggestions: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 12 },
  suggestionsTitle: { color: '#888', fontSize: 13, marginBottom: 6 },
  suggestionItem: { color: '#00c853', fontSize: 14, marginBottom: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 12, marginBottom: 10, gap: 10,
  },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  completedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  completedText: { color: '#00c853', fontSize: 18, fontWeight: '600' },
});

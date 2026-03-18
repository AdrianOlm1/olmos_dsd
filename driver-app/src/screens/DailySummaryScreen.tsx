import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDailySummary } from '../services/local-operations';
import { getUnsyncedCounts } from '../services/sync';

export default function DailySummaryScreen({ navigation }: any) {
  const [summary, setSummary] = useState<any>(null);
  const [unsyncedCounts, setUnsyncedCounts] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [sum, unsynced] = await Promise.all([getDailySummary(), getUnsyncedCounts()]);
      setSummary(sum);
      setUnsyncedCounts(unsynced);
    } catch (err: any) {
      console.error('DailySummary load failed:', err);
      setError(err?.message || 'Failed to load summary');
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalUnsynced = unsyncedCounts
    ? unsyncedCounts.invoices + unsyncedCounts.payments + unsyncedCounts.credits + unsyncedCounts.logs
    : 0;

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.loading, { color: '#ff5252', paddingHorizontal: 24, textAlign: 'center' }]}>
          {error}
        </Text>
        <TouchableOpacity onPress={loadData} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ color: '#4cc9f0' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!summary) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4cc9f0" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>End of Day Summary</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total Revenue</Text>
        <Text style={styles.revenueValue}>${summary.revenue.toFixed(2)}</Text>
        <View style={styles.revenueRow}>
          <View style={styles.revenueCol}>
            <Text style={[styles.revenueSubValue, { color: '#00c853' }]}>${summary.collected.toFixed(2)}</Text>
            <Text style={styles.revenueSubLabel}>Collected</Text>
          </View>
          <View style={styles.revenueCol}>
            <Text style={[styles.revenueSubValue, { color: '#f0a500' }]}>${(summary.revenue - summary.collected).toFixed(2)}</Text>
            <Text style={styles.revenueSubLabel}>Outstanding</Text>
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={28} color="#4cc9f0" />
          <Text style={styles.statValue}>{summary.invoices}</Text>
          <Text style={styles.statLabel}>Invoices</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={28} color="#00c853" />
          <Text style={styles.statValue}>{summary.stopsCompleted}</Text>
          <Text style={styles.statLabel}>Stops Done</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="close-circle" size={28} color="#ff5252" />
          <Text style={styles.statValue}>{summary.stopsSkipped}</Text>
          <Text style={styles.statLabel}>Skipped</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="return-down-back" size={28} color="#f0a500" />
          <Text style={styles.statValue}>{summary.credits}</Text>
          <Text style={styles.statLabel}>Credits</Text>
        </View>
      </View>

      {/* Credits */}
      {summary.creditAmount > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credits & Returns</Text>
          <Text style={styles.creditAmount}>Total Credits: ${summary.creditAmount.toFixed(2)}</Text>
        </View>
      )}

      {/* Route Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Progress</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${summary.totalStops > 0 ? (summary.stopsCompleted / summary.totalStops) * 100 : 0}%`
          }]} />
        </View>
        <Text style={styles.progressText}>
          {summary.stopsCompleted} of {summary.totalStops} stops ({summary.totalStops > 0 ? Math.round((summary.stopsCompleted / summary.totalStops) * 100) : 0}%)
        </Text>
      </View>

      {/* Sync Status */}
      <TouchableOpacity style={styles.syncCard} onPress={() => navigation.navigate('Sync')}>
        <View style={styles.syncHeader}>
          <Ionicons
            name={totalUnsynced > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'}
            size={24}
            color={totalUnsynced > 0 ? '#f0a500' : '#00c853'}
          />
          <Text style={styles.syncTitle}>
            {totalUnsynced > 0 ? `${totalUnsynced} items pending sync` : 'All synced'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </View>
        {totalUnsynced > 0 && unsyncedCounts && (
          <View style={styles.syncDetails}>
            {unsyncedCounts.invoices > 0 && <Text style={styles.syncDetail}>{unsyncedCounts.invoices} invoices</Text>}
            {unsyncedCounts.payments > 0 && <Text style={styles.syncDetail}>{unsyncedCounts.payments} payments</Text>}
            {unsyncedCounts.credits > 0 && <Text style={styles.syncDetail}>{unsyncedCounts.credits} credits</Text>}
            {unsyncedCounts.logs > 0 && <Text style={styles.syncDetail}>{unsyncedCounts.logs} delivery logs</Text>}
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  loading: { color: '#888', textAlign: 'center', marginTop: 40 },
  header: { padding: 16, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  date: { color: '#888', fontSize: 14, marginTop: 4 },
  revenueCard: {
    backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  revenueLabel: { color: '#888', fontSize: 14 },
  revenueValue: { color: '#fff', fontSize: 40, fontWeight: 'bold', marginTop: 4 },
  revenueRow: { flexDirection: 'row', marginTop: 16, width: '100%' },
  revenueCol: { flex: 1, alignItems: 'center' },
  revenueSubValue: { fontSize: 18, fontWeight: '600' },
  revenueSubLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6 },
  statCard: {
    width: '46%', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16,
    margin: '2%', alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  section: { backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#4cc9f0', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  creditAmount: { color: '#f0a500', fontSize: 16, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4cc9f0', borderRadius: 4 },
  progressText: { color: '#888', fontSize: 13, marginTop: 8 },
  syncCard: {
    backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#333', marginBottom: 32,
  },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncTitle: { color: '#fff', fontSize: 15, flex: 1 },
  syncDetails: { marginTop: 10, flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  syncDetail: { color: '#888', fontSize: 12, backgroundColor: '#0f0f23', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
});

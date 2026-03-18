import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { performSync, getUnsyncedCounts } from '../services/sync';

export default function SyncScreen() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const syncResult = await performSync();
      setResult(syncResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={syncing ? 'sync' : result ? 'cloud-done' : 'cloud-upload-outline'}
          size={80}
          color={error ? '#ff5252' : '#4cc9f0'}
        />
      </View>

      <Text style={styles.title}>
        {syncing ? 'Syncing...' : result ? 'Sync Complete' : 'Offline Sync'}
      </Text>
      <Text style={styles.subtitle}>
        {syncing
          ? 'Uploading data and downloading updates'
          : 'Sync your offline data with the server'}
      </Text>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Uploaded</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Invoices</Text>
            <Text style={styles.resultValue}>{result.uploaded.invoices}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Payments</Text>
            <Text style={styles.resultValue}>{result.uploaded.payments}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Credits</Text>
            <Text style={styles.resultValue}>{result.uploaded.credits}</Text>
          </View>

          <Text style={[styles.resultTitle, { marginTop: 16 }]}>Downloaded</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Products</Text>
            <Text style={styles.resultValue}>{result.downloaded.products}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Customers</Text>
            <Text style={styles.resultValue}>{result.downloaded.customers}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Routes</Text>
            <Text style={styles.resultValue}>{result.downloaded.routes}</Text>
          </View>

          {result.errors.length > 0 && (
            <>
              <Text style={[styles.resultTitle, { marginTop: 16, color: '#ff5252' }]}>Errors</Text>
              {result.errors.map((e: string, i: number) => (
                <Text key={i} style={styles.errorText}>{e}</Text>
              ))}
            </>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="warning" size={24} color="#ff5252" />
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color="#1a1a2e" />
        ) : (
          <>
            <Ionicons name="sync" size={22} color="#1a1a2e" />
            <Text style={styles.syncBtnText}>{result ? 'Sync Again' : 'Start Sync'}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 24, alignItems: 'center' },
  iconContainer: { marginTop: 40, marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 8 },
  resultCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20,
    width: '100%', marginTop: 24, borderWidth: 1, borderColor: '#333',
  },
  resultTitle: { color: '#4cc9f0', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  resultLabel: { color: '#888', fontSize: 15 },
  resultValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  errorText: { color: '#ff5252', fontSize: 13, marginBottom: 4 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e',
    borderRadius: 12, padding: 16, marginTop: 20, gap: 12, borderWidth: 1, borderColor: '#ff5252',
  },
  errorMessage: { color: '#ff5252', fontSize: 14, flex: 1 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4cc9f0', borderRadius: 12, padding: 18, width: '100%',
    marginTop: 24, gap: 10,
  },
  syncBtnText: { color: '#1a1a2e', fontSize: 18, fontWeight: 'bold' },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalInvoices } from '../services/local-operations';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#888', COMPLETED: '#4cc9f0', DELIVERED: '#00c853',
  REFUSED: '#ff5252', PARTIALLY_REFUSED: '#f0a500', VOIDED: '#ff5252',
};

export default function InvoiceListScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    const data = await getLocalInvoices();
    setInvoices(data);
  }, []);

  useEffect(() => {
    loadInvoices();
    const unsubscribe = navigation.addListener('focus', loadInvoices);
    return unsubscribe;
  }, [navigation, loadInvoices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const renderInvoice = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('InvoiceDetail', { localId: item.local_id, customerName: item.customer_name })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.invoiceNum}>
          {item.invoice_number || `LOCAL-${item.local_id.slice(0, 8).toUpperCase()}`}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#888' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.customerName}>{item.customer_name}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.amount}>${item.total_amount.toFixed(2)}</Text>
        <View style={styles.metaRow}>
          {!item.synced && (
            <Ionicons name="cloud-offline-outline" size={14} color="#f0a500" />
          )}
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={item => item.local_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4cc9f0" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>No invoices yet today</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#333',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNum: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  customerName: { color: '#4cc9f0', fontSize: 14, marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },
  amount: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: '#888', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 12 },
});

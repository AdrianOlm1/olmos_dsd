import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTruckInventory } from '../services/local-operations';

export default function TruckInventoryScreen() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadInventory = useCallback(async () => {
    const data = await getTruckInventory();
    setInventory(data);
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  };

  const filtered = inventory.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.product_name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
  });

  const totalLoaded = inventory.reduce((s, i) => s + i.quantity_loaded, 0);
  const totalCurrent = inventory.reduce((s, i) => s + i.quantity_current, 0);
  const totalSold = inventory.reduce((s, i) => s + i.quantity_sold, 0);

  const renderItem = ({ item }: { item: any }) => {
    const pctRemaining = item.quantity_loaded > 0 ? (item.quantity_current / item.quantity_loaded) * 100 : 0;
    const barColor = pctRemaining > 50 ? '#00c853' : pctRemaining > 20 ? '#f0a500' : '#ff5252';

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
          <Text style={styles.itemSku}>{item.sku}</Text>
        </View>

        <View style={styles.quantityRow}>
          <View style={styles.qtyCol}>
            <Text style={styles.qtyValue}>{item.quantity_loaded}</Text>
            <Text style={styles.qtyLabel}>Loaded</Text>
          </View>
          <View style={styles.qtyCol}>
            <Text style={[styles.qtyValue, { color: '#00c853' }]}>{item.quantity_sold}</Text>
            <Text style={styles.qtyLabel}>Sold</Text>
          </View>
          <View style={styles.qtyCol}>
            <Text style={[styles.qtyValue, { color: '#f0a500' }]}>{item.quantity_returned}</Text>
            <Text style={styles.qtyLabel}>Returned</Text>
          </View>
          <View style={styles.qtyCol}>
            <Text style={[styles.qtyValue, { color: barColor }]}>{item.quantity_current}</Text>
            <Text style={styles.qtyLabel}>Current</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pctRemaining}%`, backgroundColor: barColor }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalLoaded}</Text>
          <Text style={styles.summaryLabel}>Loaded</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#00c853' }]}>{totalSold}</Text>
          <Text style={styles.summaryLabel}>Sold</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#4cc9f0' }]}>{totalCurrent}</Text>
          <Text style={styles.summaryLabel}>On Truck</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{inventory.length}</Text>
          <Text style={styles.summaryLabel}>SKUs</Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or SKU..."
        placeholderTextColor="#666"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4cc9f0" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>No truck inventory loaded</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  summary: {
    flexDirection: 'row', backgroundColor: '#1a1a2e', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#333',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  searchInput: {
    backgroundColor: '#1a1a2e', margin: 12, borderRadius: 10,
    padding: 12, color: '#fff', borderWidth: 1, borderColor: '#333',
  },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  itemCard: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#333',
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  itemSku: { color: '#888', fontSize: 12, marginLeft: 8 },
  quantityRow: { flexDirection: 'row', marginBottom: 8 },
  qtyCol: { flex: 1, alignItems: 'center' },
  qtyValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qtyLabel: { color: '#888', fontSize: 10, marginTop: 2 },
  progressBar: { height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 12 },
});

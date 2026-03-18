import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalProducts, createLocalCredit } from '../services/local-operations';

const CREDIT_REASONS = [
  { key: 'DAMAGED_IN_TRANSIT', label: 'Damaged in Transit' },
  { key: 'EXPIRED_PRODUCT', label: 'Expired Product' },
  { key: 'WRONG_PRODUCT', label: 'Wrong Product' },
  { key: 'CUSTOMER_RETURN', label: 'Customer Return' },
  { key: 'PRICING_ERROR', label: 'Pricing Error' },
  { key: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { key: 'OTHER', label: 'Other' },
];

const RETURN_CONDITIONS = [
  { key: 'RESALABLE', label: 'Resalable', color: '#00c853' },
  { key: 'DAMAGED', label: 'Damaged', color: '#ff5252' },
  { key: 'EXPIRED', label: 'Expired', color: '#f0a500' },
  { key: 'DISPOSAL', label: 'Disposal', color: '#888' },
];

interface CreditLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  condition: string;
}

export default function CreditMemoScreen({ navigation, route }: any) {
  const { customerId, customerName } = route.params;
  const [reason, setReason] = useState('CUSTOMER_RETURN');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<CreditLine[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await getLocalProducts();
    setProducts(data);
  };

  const addProduct = (product: any) => {
    if (lines.find(l => l.productId === product.id)) return;
    setLines(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.base_price,
      condition: 'RESALABLE',
    }]);
    setShowCatalog(false);
    setSearch('');
  };

  const updateLine = (productId: string, field: string, value: any) => {
    setLines(prev => prev.map(l =>
      l.productId === productId ? { ...l, [field]: value } : l
    ));
  };

  const removeLine = (productId: string) => {
    setLines(prev => prev.filter(l => l.productId !== productId));
  };

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const handleSubmit = async () => {
    if (lines.length === 0) {
      Alert.alert('Error', 'Add at least one product');
      return;
    }

    Alert.alert('Create Credit Memo', `Total credit: $${total.toFixed(2)}\n\nProceed?`, [
      { text: 'Cancel' },
      {
        text: 'Create',
        onPress: async () => {
          try {
            await createLocalCredit({
              customerId,
              reason,
              notes,
              lines: lines.map(l => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                condition: l.condition,
              })),
            });
            Alert.alert('Credit Created', `Credit memo for $${total.toFixed(2)} created`, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.customerBanner}>
          <Text style={styles.customerText}>{customerName}</Text>
        </View>

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credit Reason</Text>
          <View style={styles.reasonGrid}>
            {CREDIT_REASONS.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.reasonBtn, reason === r.key && styles.reasonBtnActive]}
                onPress={() => setReason(r.key)}
              >
                <Text style={[styles.reasonText, reason === r.key && styles.reasonTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Returned Products</Text>
          {lines.map(line => (
            <View key={line.productId} style={styles.lineItem}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineName}>{line.productName}</Text>
                <TouchableOpacity onPress={() => removeLine(line.productId)}>
                  <Ionicons name="close-circle" size={20} color="#ff5252" />
                </TouchableOpacity>
              </View>

              <View style={styles.lineControls}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity onPress={() => updateLine(line.productId, 'quantity', Math.max(1, line.quantity - 1))} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={16} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{line.quantity}</Text>
                  <TouchableOpacity onPress={() => updateLine(line.productId, 'quantity', line.quantity + 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.lineTotal}>${(line.quantity * line.unitPrice).toFixed(2)}</Text>
              </View>

              <View style={styles.conditionRow}>
                {RETURN_CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.condBtn, line.condition === c.key && { borderColor: c.color, backgroundColor: c.color + '20' }]}
                    onPress={() => updateLine(line.productId, 'condition', c.key)}
                  >
                    <Text style={[styles.condText, line.condition === c.key && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCatalog(!showCatalog)}>
            <Ionicons name="add-circle-outline" size={20} color="#4cc9f0" />
            <Text style={styles.addBtnText}>Add Product</Text>
          </TouchableOpacity>

          {showCatalog && (
            <View style={styles.catalog}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#666"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              <FlatList
                data={filtered.slice(0, 15)}
                keyExtractor={item => item.id}
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.catalogItem} onPress={() => addProduct(item)}>
                    <Text style={styles.catalogName}>{item.name}</Text>
                    <Text style={styles.catalogPrice}>${item.base_price.toFixed(2)}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        <TextInput
          style={styles.notesInput}
          placeholder="Additional notes..."
          placeholderTextColor="#666"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Credit Total</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>Create Credit Memo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  customerBanner: { backgroundColor: '#1a1a2e', padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  customerText: { color: '#4cc9f0', fontSize: 16, fontWeight: '600' },
  section: { backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#4cc9f0', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  reasonBtnActive: { borderColor: '#4cc9f0', backgroundColor: '#4cc9f020' },
  reasonText: { color: '#888', fontSize: 13 },
  reasonTextActive: { color: '#4cc9f0' },
  lineItem: { backgroundColor: '#0f0f23', borderRadius: 10, padding: 12, marginBottom: 8 },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  lineControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { backgroundColor: '#333', borderRadius: 6, padding: 4 },
  qtyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lineTotal: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  conditionRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  condBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#333' },
  condText: { color: '#888', fontSize: 10, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 },
  addBtnText: { color: '#4cc9f0', fontSize: 15 },
  catalog: { backgroundColor: '#16213e', borderRadius: 8, padding: 10 },
  searchInput: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, color: '#fff', marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  catalogItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  catalogName: { color: '#fff', fontSize: 14 },
  catalogPrice: { color: '#888', fontSize: 13 },
  notesInput: { backgroundColor: '#1a1a2e', margin: 12, borderRadius: 10, padding: 12, color: '#fff', minHeight: 60, borderWidth: 1, borderColor: '#333', textAlignVertical: 'top' },
  footer: { backgroundColor: '#1a1a2e', padding: 16, borderTopWidth: 1, borderTopColor: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: '#888', fontSize: 18 },
  totalValue: { color: '#f0a500', fontSize: 20, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#f0a500', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitText: { color: '#1a1a2e', fontSize: 16, fontWeight: 'bold' },
});

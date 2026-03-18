import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalProducts, resolveLocalPrice, createLocalInvoice, getTruckInventory } from '../services/local-operations';

interface LineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  effectivePrice: number;
  truckQty: number;
  promotionId?: string;
}

export default function CreateInvoiceScreen({ navigation, route }: any) {
  const { customerId, locationId, routeId, customerName } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [truckStock, setTruckStock] = useState<Map<string, number>>(new Map());
  const [lines, setLines] = useState<LineItem[]>([]);
  const [search, setSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [prods, inventory] = await Promise.all([
      getLocalProducts(),
      getTruckInventory(),
    ]);
    setProducts(prods);
    const stockMap = new Map<string, number>();
    for (const item of inventory) {
      stockMap.set(item.product_id, item.quantity_current);
    }
    setTruckStock(stockMap);
  };

  const addProduct = async (product: any) => {
    const existing = lines.find(l => l.productId === product.id);
    if (existing) {
      Alert.alert('Already Added', 'This product is already in the invoice. Adjust the quantity instead.');
      return;
    }

    const truckQty = truckStock.get(product.id) || 0;
    if (truckQty <= 0) {
      Alert.alert('Out of Stock', 'This product is not on your truck.');
      return;
    }

    const price = await resolveLocalPrice(product.id, customerId);

    setLines(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      unitPrice: price.unitPrice,
      discount: price.unitPrice - price.effectivePrice,
      effectivePrice: price.effectivePrice,
      truckQty,
    }]);

    setShowCatalog(false);
    setSearch('');
  };

  const updateQuantity = (productId: string, qty: number) => {
    setLines(prev => prev.map(l => {
      if (l.productId === productId) {
        const newQty = Math.max(0, Math.min(qty, l.truckQty));
        return { ...l, quantity: newQty };
      }
      return l;
    }).filter(l => l.quantity > 0));
  };

  const removeLine = (productId: string) => {
    setLines(prev => prev.filter(l => l.productId !== productId));
  };

  const subtotal = lines.reduce((sum, l) => sum + l.effectivePrice * l.quantity, 0);
  const total = subtotal;

  const handleSubmit = async () => {
    if (lines.length === 0) {
      Alert.alert('Error', 'Add at least one product');
      return;
    }

    Alert.alert('Create Invoice', `Total: $${total.toFixed(2)}\n\nProceed?`, [
      { text: 'Cancel' },
      {
        text: 'Create',
        onPress: async () => {
          try {
            const result = await createLocalInvoice({
              customerId,
              locationId,
              routeId,
              lines: lines.map(l => ({
                productId: l.productId,
                productName: l.productName,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discount: l.discount,
                promotionId: l.promotionId,
              })),
              notes,
            });

            navigation.replace('InvoiceDetail', {
              localId: result.localId,
              justCreated: true,
              customerId,
              customerName,
            });
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const filteredProducts = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.upc && p.upc.includes(q));
  });

  return (
    <View style={styles.container}>
      <View style={styles.customerBanner}>
        <Text style={styles.customerText}>{customerName}</Text>
      </View>

      {/* Line items */}
      <ScrollView style={styles.linesContainer}>
        {lines.map(line => (
          <View key={line.productId} style={styles.lineItem}>
            <View style={styles.lineInfo}>
              <Text style={styles.lineName} numberOfLines={1}>{line.productName}</Text>
              <Text style={styles.lineSku}>{line.sku}</Text>
              {line.discount > 0 && (
                <Text style={styles.lineDiscount}>Discount: -${line.discount.toFixed(2)}/ea</Text>
              )}
            </View>
            <View style={styles.lineActions}>
              <Text style={styles.linePrice}>${(line.effectivePrice * line.quantity).toFixed(2)}</Text>
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => updateQuantity(line.productId, line.quantity - 1)} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{line.quantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(line.productId, line.quantity + 1)} style={styles.qtyBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.truckQty}>Truck: {line.truckQty}</Text>
              <TouchableOpacity onPress={() => removeLine(line.productId)}>
                <Ionicons name="trash-outline" size={18} color="#ff5252" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCatalog(!showCatalog)}>
          <Ionicons name="add-circle-outline" size={22} color="#4cc9f0" />
          <Text style={styles.addBtnText}>Add Product</Text>
        </TouchableOpacity>

        {showCatalog && (
          <View style={styles.catalog}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, SKU, or UPC..."
              placeholderTextColor="#666"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <FlatList
              data={filteredProducts.slice(0, 20)}
              keyExtractor={item => item.id}
              style={{ maxHeight: 250 }}
              renderItem={({ item }) => {
                const stock = truckStock.get(item.id) || 0;
                return (
                  <TouchableOpacity
                    style={[styles.catalogItem, stock <= 0 && styles.catalogItemOOS]}
                    onPress={() => addProduct(item)}
                    disabled={stock <= 0}
                  >
                    <View>
                      <Text style={styles.catalogName}>{item.name}</Text>
                      <Text style={styles.catalogSku}>{item.sku} | ${item.base_price.toFixed(2)}</Text>
                    </View>
                    <Text style={[styles.catalogStock, stock <= 0 && { color: '#ff5252' }]}>
                      {stock > 0 ? `${stock} avail` : 'OOS'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        <TextInput
          style={styles.notesInput}
          placeholder="Notes (optional)"
          placeholderTextColor="#666"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </ScrollView>

      {/* Footer total */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { fontSize: 20, fontWeight: 'bold' }]}>Total</Text>
          <Text style={[styles.totalValue, { fontSize: 20, fontWeight: 'bold' }]}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>Create Invoice ({lines.length} items)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  customerBanner: { backgroundColor: '#1a1a2e', padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  customerText: { color: '#4cc9f0', fontSize: 16, fontWeight: '600' },
  linesContainer: { flex: 1, padding: 12 },
  lineItem: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#333',
  },
  lineInfo: { flex: 1 },
  lineName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  lineSku: { color: '#888', fontSize: 12, marginTop: 2 },
  lineDiscount: { color: '#00c853', fontSize: 11, marginTop: 2 },
  lineActions: { alignItems: 'flex-end', gap: 4 },
  linePrice: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { backgroundColor: '#333', borderRadius: 6, padding: 4 },
  qtyText: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  truckQty: { color: '#888', fontSize: 11 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  addBtnText: { color: '#4cc9f0', fontSize: 16 },
  catalog: { backgroundColor: '#16213e', borderRadius: 10, padding: 12, marginBottom: 12 },
  searchInput: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  catalogItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  catalogItemOOS: { opacity: 0.4 },
  catalogName: { color: '#fff', fontSize: 14 },
  catalogSku: { color: '#888', fontSize: 12 },
  catalogStock: { color: '#00c853', fontSize: 12 },
  notesInput: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, color: '#fff', minHeight: 60, borderWidth: 1, borderColor: '#333', marginTop: 8, textAlignVertical: 'top' },
  footer: { backgroundColor: '#1a1a2e', padding: 16, borderTopWidth: 1, borderTopColor: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { color: '#888', fontSize: 16 },
  totalValue: { color: '#fff', fontSize: 16 },
  submitBtn: { backgroundColor: '#00c853', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

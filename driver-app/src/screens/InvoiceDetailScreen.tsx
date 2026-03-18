import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLocalInvoiceDetails } from '../services/local-operations';

export default function InvoiceDetailScreen({ navigation, route }: any) {
  const { localId, justCreated, customerName } = route.params;
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    loadInvoice();
  }, []);

  const loadInvoice = async () => {
    const data = await getLocalInvoiceDetails(localId);
    setInvoice(data);
  };

  if (!invoice) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const statusColor = {
    DRAFT: '#888', COMPLETED: '#4cc9f0', DELIVERED: '#00c853',
    REFUSED: '#ff5252', PARTIALLY_REFUSED: '#f0a500', VOIDED: '#ff5252',
  }[invoice.status] || '#888';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number || `LOCAL-${localId.slice(0, 8).toUpperCase()}`}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{invoice.status}</Text>
          </View>
        </View>
        <Text style={styles.customerNameText}>{invoice.customer_name}</Text>
        <Text style={styles.dateText}>{new Date(invoice.created_at).toLocaleString()}</Text>
        {!invoice.synced && (
          <View style={styles.syncBadge}>
            <Ionicons name="cloud-offline-outline" size={14} color="#f0a500" />
            <Text style={styles.syncText}>Pending Sync</Text>
          </View>
        )}
      </View>

      {/* Line Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Items</Text>
        {invoice.lines?.map((line: any) => (
          <View key={line.local_id} style={[styles.lineItem, line.refused && styles.lineRefused]}>
            <View style={styles.lineLeft}>
              <Text style={[styles.lineName, line.refused && styles.lineNameRefused]}>
                {line.product_name}
              </Text>
              <Text style={styles.lineSku}>{line.sku}</Text>
              {line.refused ? (
                <Text style={styles.refusedText}>REFUSED: {line.refused_reason || 'No reason'}</Text>
              ) : null}
            </View>
            <View style={styles.lineRight}>
              <Text style={styles.lineQty}>{line.quantity} x ${line.unit_price.toFixed(2)}</Text>
              {line.discount > 0 && <Text style={styles.lineDiscountText}>-${(line.discount * line.quantity).toFixed(2)}</Text>}
              <Text style={styles.lineTotal}>${line.line_total.toFixed(2)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.section}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${invoice.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax</Text>
          <Text style={styles.totalValue}>${invoice.tax_amount.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>${invoice.total_amount.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Paid</Text>
          <Text style={[styles.totalValue, { color: '#00c853' }]}>${invoice.amount_paid.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Balance Due</Text>
          <Text style={[styles.totalValue, { color: invoice.balance_due > 0 ? '#f0a500' : '#00c853' }]}>
            ${invoice.balance_due.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Payments */}
      {invoice.payments?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          {invoice.payments.map((pmt: any) => (
            <View key={pmt.local_id} style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentMethod}>{pmt.method}</Text>
                {pmt.check_number && <Text style={styles.checkNumber}>Check #{pmt.check_number}</Text>}
              </View>
              <Text style={styles.paymentAmount}>${pmt.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Signature */}
      {invoice.signed_by_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proof of Delivery</Text>
          <Text style={styles.signedBy}>Signed by: {invoice.signed_by_name}</Text>
          <Text style={styles.deliveredAt}>
            Delivered: {invoice.delivered_at ? new Date(invoice.delivered_at).toLocaleString() : 'N/A'}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {(justCreated || invoice.status === 'COMPLETED') && (
        <View style={styles.actions}>
          {invoice.balance_due > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#00c853' }]}
              onPress={() => navigation.navigate('Payment', { invoiceLocalId: localId, balanceDue: invoice.balance_due })}
            >
              <Ionicons name="cash-outline" size={20} color="#fff" />
              <Text style={styles.actionText}>Collect Payment</Text>
            </TouchableOpacity>
          )}

          {!invoice.signature_data && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#4cc9f0' }]}
              onPress={() => navigation.navigate('Signature', { invoiceLocalId: localId, customerName: invoice.customer_name })}
            >
              <Ionicons name="create-outline" size={20} color="#1a1a2e" />
              <Text style={[styles.actionText, { color: '#1a1a2e' }]}>Capture Signature</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  loading: { color: '#888', textAlign: 'center', marginTop: 40 },
  header: { backgroundColor: '#1a1a2e', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNumber: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  customerNameText: { color: '#4cc9f0', fontSize: 16, marginTop: 8 },
  dateText: { color: '#888', fontSize: 13, marginTop: 4 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  syncText: { color: '#f0a500', fontSize: 12 },
  section: { backgroundColor: '#1a1a2e', margin: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#4cc9f0', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  lineRefused: { opacity: 0.5 },
  lineLeft: { flex: 1 },
  lineName: { color: '#fff', fontSize: 14 },
  lineNameRefused: { textDecorationLine: 'line-through' },
  lineSku: { color: '#888', fontSize: 11, marginTop: 2 },
  refusedText: { color: '#ff5252', fontSize: 11, marginTop: 4 },
  lineRight: { alignItems: 'flex-end' },
  lineQty: { color: '#888', fontSize: 13 },
  lineDiscountText: { color: '#00c853', fontSize: 11 },
  lineTotal: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { color: '#888', fontSize: 15 },
  totalValue: { color: '#fff', fontSize: 15 },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8, marginTop: 4 },
  grandTotalLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  grandTotalValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  paymentMethod: { color: '#fff', fontSize: 14 },
  checkNumber: { color: '#888', fontSize: 12 },
  paymentAmount: { color: '#00c853', fontSize: 15, fontWeight: '600' },
  signedBy: { color: '#fff', fontSize: 14 },
  deliveredAt: { color: '#888', fontSize: 13, marginTop: 4 },
  actions: { padding: 12, gap: 10, marginBottom: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 10 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

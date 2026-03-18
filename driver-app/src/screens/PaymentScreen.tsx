import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collectLocalPayment } from '../services/local-operations';

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: 'cash-outline' as const, color: '#00c853' },
  { key: 'CHECK', label: 'Check', icon: 'document-outline' as const, color: '#4cc9f0' },
  { key: 'ON_ACCOUNT', label: 'On Account', icon: 'time-outline' as const, color: '#f0a500' },
];

export default function PaymentScreen({ navigation, route }: any) {
  const { invoiceLocalId, balanceDue } = route.params;
  const [method, setMethod] = useState<string>('CASH');
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [checkNumber, setCheckNumber] = useState('');

  const handleCollect = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (numAmount > balanceDue) {
      Alert.alert('Error', `Amount cannot exceed balance due of $${balanceDue.toFixed(2)}`);
      return;
    }
    if (method === 'CHECK' && !checkNumber) {
      Alert.alert('Error', 'Enter check number');
      return;
    }

    try {
      await collectLocalPayment({
        invoiceLocalId,
        amount: numAmount,
        method: method as 'CASH' | 'CHECK' | 'ON_ACCOUNT',
        checkNumber: method === 'CHECK' ? checkNumber : undefined,
      });

      Alert.alert('Payment Collected', `$${numAmount.toFixed(2)} ${method} payment recorded`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance Due</Text>
        <Text style={styles.balanceValue}>${balanceDue.toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodBtn, method === m.key && { borderColor: m.color, backgroundColor: m.color + '20' }]}
              onPress={() => setMethod(m.key)}
            >
              <Ionicons name={m.icon} size={24} color={method === m.key ? m.color : '#888'} />
              <Text style={[styles.methodLabel, method === m.key && { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>
        <TouchableOpacity onPress={() => setAmount(balanceDue.toFixed(2))}>
          <Text style={styles.fullAmountLink}>Pay full balance</Text>
        </TouchableOpacity>
      </View>

      {method === 'CHECK' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Check Number</Text>
          <TextInput
            style={styles.input}
            value={checkNumber}
            onChangeText={setCheckNumber}
            keyboardType="number-pad"
            placeholder="Enter check number"
            placeholderTextColor="#666"
          />
        </View>
      )}

      <TouchableOpacity style={styles.collectBtn} onPress={handleCollect}>
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={styles.collectText}>Collect ${parseFloat(amount || '0').toFixed(2)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  balanceCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 16,
  },
  balanceLabel: { color: '#888', fontSize: 14 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  section: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#4cc9f0', fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodBtn: {
    flex: 1, alignItems: 'center', padding: 16, borderRadius: 10,
    borderWidth: 2, borderColor: '#333', gap: 6,
  },
  methodLabel: { color: '#888', fontSize: 12, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { color: '#fff', fontSize: 28, marginRight: 4 },
  amountInput: { color: '#fff', fontSize: 28, fontWeight: 'bold', flex: 1 },
  fullAmountLink: { color: '#4cc9f0', fontSize: 13, marginTop: 8 },
  input: { backgroundColor: '#0f0f23', borderRadius: 8, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#333' },
  collectBtn: {
    backgroundColor: '#00c853', borderRadius: 12, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16,
  },
  collectText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

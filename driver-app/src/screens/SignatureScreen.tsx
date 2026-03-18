import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInvoice } from '../services/local-operations';

// Note: In production, use react-native-signature-canvas
// For now, we simulate with a text input for the name
export default function SignatureScreen({ navigation, route }: any) {
  const { invoiceLocalId, customerName } = route.params;
  const [signedByName, setSignedByName] = useState('');
  const [signed, setSigned] = useState(false);

  const handleSign = async () => {
    if (!signedByName.trim()) {
      Alert.alert('Error', 'Enter the name of the person signing');
      return;
    }

    try {
      // In production: capture actual signature canvas data as base64
      const signatureData = `SIGNATURE_PLACEHOLDER_${Date.now()}`;
      await signInvoice(invoiceLocalId, signatureData, signedByName.trim());
      setSigned(true);

      Alert.alert('Signed', 'Proof of delivery captured successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Proof of Delivery</Text>
        <Text style={styles.subtitle}>{customerName}</Text>
      </View>

      <View style={styles.signatureArea}>
        <Text style={styles.signatureLabel}>Signature Area</Text>
        <View style={styles.signatureBox}>
          {/* In production, this would be a SignatureCanvas component */}
          <Text style={styles.signaturePlaceholder}>
            {signed ? 'Signed' : 'Tap and sign here'}
          </Text>
          <Text style={styles.signatureHint}>
            (In production build: touch signature canvas)
          </Text>
        </View>
      </View>

      <View style={styles.nameSection}>
        <Text style={styles.nameLabel}>Print Name</Text>
        <TextInput
          style={styles.nameInput}
          value={signedByName}
          onChangeText={setSignedByName}
          placeholder="Full name of receiver"
          placeholderTextColor="#666"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={() => { setSignedByName(''); setSigned(false); }}>
          <Ionicons name="refresh" size={20} color="#ff5252" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleSign}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.confirmText}>Confirm Delivery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },
  header: { marginBottom: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  subtitle: { color: '#4cc9f0', fontSize: 16, marginTop: 4 },
  signatureArea: { marginBottom: 24 },
  signatureLabel: { color: '#888', fontSize: 13, marginBottom: 8, textTransform: 'uppercase' },
  signatureBox: {
    backgroundColor: '#fff', borderRadius: 12, height: 200,
    justifyContent: 'center', alignItems: 'center',
  },
  signaturePlaceholder: { color: '#999', fontSize: 16 },
  signatureHint: { color: '#ccc', fontSize: 12, marginTop: 8 },
  nameSection: { marginBottom: 24 },
  nameLabel: { color: '#888', fontSize: 13, marginBottom: 8, textTransform: 'uppercase' },
  nameInput: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16,
    color: '#fff', fontSize: 18, borderWidth: 1, borderColor: '#333',
  },
  actions: { flexDirection: 'row', gap: 12 },
  clearBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#ff5252', gap: 8,
  },
  clearText: { color: '#ff5252', fontSize: 16, fontWeight: '600' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 12, backgroundColor: '#00c853', gap: 8,
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

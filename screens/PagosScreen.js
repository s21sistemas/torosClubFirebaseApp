import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PagosScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagos</Text>
      <Text>Aquí puedes gestionar tus pagos.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default PagosScreen;
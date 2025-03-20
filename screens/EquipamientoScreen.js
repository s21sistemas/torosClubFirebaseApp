import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EquipamientoScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equipamiento</Text>
      <Text>Aquí podrás gestionar tu equipamiento espera nuestras proximas actualizaciones.</Text>
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

export default EquipamientoScreen;
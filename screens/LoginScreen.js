import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Image } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { auth } from '../firebaseConfig'; // Importa Firebase Auth
import { signInWithEmailAndPassword, userCredential } from 'firebase/auth'; // Importa la función de inicio de sesión

SplashScreen.preventAutoHideAsync();

const LoginScreen = ({ navigation }) => {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errors, setErrors] = useState({
    correo: '',
    contrasena: '',
  });

  // Cargar la fuente personalizada
  const [fontsLoaded] = useFonts({
    'MiFuente': require('../fonts/TypoCollegeDemo.otf'),
  });

  // Ocultar la pantalla de splash cuando la fuente esté cargada
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Si la fuente no está cargada, retornar null
  if (!fontsLoaded) {
    return null;
  }

  const validateForm = () => {
    let isValid = true;
    const newErrors = { correo: '', contrasena: '' };

    if (!correo.trim()) {
      newErrors.correo = 'El correo es obligatorio.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      newErrors.correo = 'El correo no es válido.';
      isValid = false;
    }

    if (!contrasena.trim()) {
      newErrors.contrasena = 'La contraseña es obligatoria.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (validateForm()) {
      try {
        // Iniciar sesión con Firebase Authentication
        await signInWithEmailAndPassword(auth, correo, contrasena);
        navigation.navigate('MainTabs'); // Navegar a la pantalla principal después del login
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        Alert.alert('Error', 'Correo o contraseña incorrectos. Por favor, intenta de nuevo.');
        showAlert('Error', 'Correo o contraseña incorrectos. Por favor, intenta de nuevo.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.rectangle}>
        <View style={styles.leftColumn}>
          <Image
            source={require('../assets/logoPotros.jpg')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.welcomeText}>Iniciar Sesión</Text>
          <Text style={styles.subtitle}>Acceso exclusivo para padres/tutores de jugadores</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Correo"
            placeholderTextColor="#999"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
          />
          {errors.correo ? <Text style={styles.errorText}>{errors.correo}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#999"
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry
          />
          {errors.contrasena ? <Text style={styles.errorText}>{errors.contrasena}</Text> : null}

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>¿No tienes una cuenta? Regístrate</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rectangle: {
    flexDirection: 'row',
    width: '90%',
    height: '57%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#b51f28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightColumn: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  welcomeText: {
    fontFamily: 'MiFuente',
    fontSize: 35,
    color: '#000',
    textAlign: 'center',
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  input: {
    height: 45,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  loginButton: {
    backgroundColor: '#b51f28',
    padding: 10,
    borderRadius: 22,
    alignItems: 'center',
    marginBottom: 15,
    height: 40,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  linkText: {
    color: '#b51f28',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginBottom: 10,
  },
  image: {
    width: '80%',
    height: '80%',
  },
});

export default LoginScreen;
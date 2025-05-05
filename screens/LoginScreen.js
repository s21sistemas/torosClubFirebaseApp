import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Alert, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

SplashScreen.preventAutoHideAsync();

const LoginScreen = ({ navigation }) => {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errors, setErrors] = useState({
    correo: '',
    contrasena: '',
  });

  const [fontsLoaded] = useFonts({
    'MiFuente': require('../fonts/TypoCollegeDemo.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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
        await signInWithEmailAndPassword(auth, correo, contrasena);
        navigation.navigate('MainTabs');
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        Alert.alert('Error', 'Correo o contraseña incorrectos. Por favor, intenta de nuevo.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.loginContainer}>
              <View style={styles.headerContainer}>
                <Image
                  source={require('../assets/logoToros.jpg')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.welcomeText}>Iniciar Sesión</Text>
                <Text style={styles.subtitle}>Acceso exclusivo para padres/tutores de jugadores</Text>
              </View>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, errors.correo ? styles.inputError : null]}
                  placeholder="Correo electrónico"
                  placeholderTextColor="#999"
                  value={correo}
                  onChangeText={setCorreo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.correo ? <Text style={styles.errorText}>{errors.correo}</Text> : null}

                <TextInput
                  style={[styles.input, errors.contrasena ? styles.inputError : null]}
                  placeholder="Contraseña"
                  placeholderTextColor="#999"
                  value={contrasena}
                  onChangeText={setContrasena}
                  secureTextEntry
                />
                {errors.contrasena ? <Text style={styles.errorText}>{errors.contrasena}</Text> : null}

                <TouchableOpacity 
                  style={styles.loginButton} 
                  onPress={handleLogin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                </TouchableOpacity>

                <View style={styles.linksContainer}>
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('Register')}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkTextBold}>Regístrate</Text></Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loginContainer: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginHorizontal: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  welcomeText: {
    fontFamily: 'MiFuente',
    fontSize: 32,
    color: '#ffbe00',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formContainer: {
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ffbe00',
  },
  errorText: {
    color: '#ffbe00',
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 15,
  },
  loginButton: {
    backgroundColor: '#ffbe00',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#ffbe00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linksContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkButton: {
    marginVertical: 8,
  },
  linkText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  linkTextBold: {
    color: '#ffbe00',
    fontWeight: 'bold',
  },
});

export default LoginScreen;
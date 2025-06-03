import React, { useState } from 'react';
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
  ScrollView
} from 'react-native';
import { auth } from '../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const ForgotPasswordScreen = ({ navigation }) => {
  const [correo, setCorreo] = useState('');
  const [errors, setErrors] = useState({
    correo: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    'MiFuente': require('../fonts/TypoCollegeDemo.otf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  const validateForm = () => {
    let isValid = true;
    const newErrors = { correo: '' };

    if (!correo.trim()) {
      newErrors.correo = 'El correo es obligatorio.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      newErrors.correo = 'El correo no es válido.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleResetPassword = async () => {
    if (validateForm()) {
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, correo);
        Alert.alert(
          'Correo enviado',
          'Se ha enviado un enlace para restablecer tu contraseña a tu correo electrónico.',
          [
            { text: 'OK', onPress: () => navigation.navigate('Login') }
          ]
        );
      } catch (error) {
        console.error('Error al enviar correo de recuperación:', error);
        Alert.alert(
          'Error',
          'No se pudo enviar el correo de recuperación. Verifica que el correo esté registrado.'
        );
      } finally {
        setIsLoading(false);
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
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginContainer}>
            <View style={styles.headerContainer}>
              <Image
                source={require('../assets/logoPotros.jpg')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.welcomeText}>Recuperar Contraseña</Text>
              <Text style={styles.subtitle}>Ingresa tu correo para recibir instrucciones</Text>
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

              <TouchableOpacity 
                style={[styles.loginButton, isLoading ? styles.disabledButton : null]} 
                onPress={handleResetPassword}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Enviando...' : 'Enviar Instrucciones'}
                </Text>
              </TouchableOpacity>

              <View style={styles.linksContainer}>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Login')}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>Volver a Iniciar Sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
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
    color: '#b51f28',
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
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 15,
  },
  loginButton: {
    backgroundColor: '#b51f28',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#b51f28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
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
});

export default ForgotPasswordScreen;
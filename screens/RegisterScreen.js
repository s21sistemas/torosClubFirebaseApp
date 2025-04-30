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
  Pressable, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
//ffbe00
const RegisterScreen = ({ navigation }) => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ocupacion, setOcupacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    nombreCompleto: '',
    correo: '',
    telefono: '',
    ocupacion: '',
  });

  const showAlert = (title, message, isSuccess = false) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(
        title,
        message,
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (isSuccess) {
                navigation.navigate('Login');
              }
            }
          }
        ]
      );
    }
  };

  // Función para traducir errores de Firebase
  const translateFirebaseError = (error) => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'El correo electrónico ya está registrado. ¿Ya tienes una cuenta?';
      case 'auth/invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'auth/weak-password':
        return 'La contraseña generada no es segura. Por favor, inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Problema de conexión a internet. Verifica tu conexión.';
      default:
        return 'Ocurrió un error al registrar. Por favor, inténtalo de nuevo.';
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { nombreCompleto: '', correo: '', telefono: '', ocupacion: '' };

    if (!nombreCompleto.trim()) {
      newErrors.nombreCompleto = 'El nombre completo es obligatorio.';
      isValid = false;
    }

    if (!correo.trim()) {
      newErrors.correo = 'El correo es obligatorio.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      newErrors.correo = 'El correo no es válido.';
      isValid = false;
    }

    if (!telefono.trim()) {
      newErrors.telefono = 'El teléfono es obligatorio.';
      isValid = false;
    } else if (!/^\d{10}$/.test(telefono)) {
      newErrors.telefono = 'El teléfono debe tener 10 dígitos.';
      isValid = false;
    }

    if (!ocupacion.trim()) {
      newErrors.ocupacion = 'La ocupación es obligatoria.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const generateRandomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const isCodeUnique = async (code) => {
    const q = query(collection(db, 'usuarios'), where('codigo_acceso', '==', code));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  };

  const sendEmail = async (email, code) => {
    try {
      const response = await fetch('https://us-central1-clubtoros-c8a29.cloudfunctions.net/sendEmailFunction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error('No se pudo enviar el correo.');
      }
    } catch (err) {
      console.error('Error al enviar el correo:', err);
      throw new Error('No se pudo enviar el correo. El código de acceso es: ' + code);
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Generar un código único
      let codigoAcceso;
      let isUnique = false;
      let intentos = 0;
      const maxIntentos = 5;

      while (!isUnique && intentos < maxIntentos) {
        codigoAcceso = generateRandomCode();
        isUnique = await isCodeUnique(codigoAcceso);
        intentos++;
      }

      if (!isUnique) {
        throw new Error('No se pudo generar un código único. Por favor, inténtalo de nuevo.');
      }

      // Mostrar feedback visual
      Alert.alert(
        'Registrando usuario',
        'Estamos creando tu cuenta. Por favor espera...',
        [],
        { cancelable: false }
      );

      // Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, correo, codigoAcceso);
      const user = userCredential.user;

      // Guardar datos en Firestore
      const userData = {
        uid: user.uid,
        rol_id: user.uid,
        nombre_completo: nombreCompleto,
        correo,
        celular: telefono,
        ocupacion,
        codigo_acceso: codigoAcceso,
        fecha_registro: new Date().toISOString(),
      };

      await addDoc(collection(db, 'usuarios'), userData);

      // Enviar correo con el código
      Alert.alert(
        'Enviando código de acceso',
        'Estamos enviando el código a tu correo electrónico...',
        [],
        { cancelable: false }
      );

      await sendEmail(correo, codigoAcceso);

      // Éxito - mostrar mensaje y redirigir
      showAlert(
        '¡Registro exitoso!', 
        `Usuario registrado correctamente. Tu código de acceso ha sido enviado a tu correo electrónico.`, 
        true
      );

    } catch (err) {
      console.error('Error al registrar el usuario:', err);
      
      // Manejar errores específicos de Firebase
      const errorMessage = err.code 
        ? translateFirebaseError(err) 
        : err.message || 'Error al registrar el usuario. Por favor, inténtalo de nuevo.';
      
      showAlert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.rectangle}>
        <View style={styles.leftColumn}>
          <Image
            source={require('../assets/logoToros.jpg')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.welcomeText}>Registro</Text>
          <Text style={styles.subtitle}>Registro para padres/tutores de jugadores</Text>
          
          <TextInput
            style={[styles.input, errors.nombreCompleto ? styles.inputError : null]}
            placeholder="Nombre Completo"
            placeholderTextColor="#999"
            value={nombreCompleto}
            onChangeText={setNombreCompleto}
            editable={!loading}
          />
          {errors.nombreCompleto ? <Text style={styles.errorText}>{errors.nombreCompleto}</Text> : null}

          <TextInput
            style={[styles.input, errors.correo ? styles.inputError : null]}
            placeholder="Correo electrónico"
            placeholderTextColor="#999"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          {errors.correo ? <Text style={styles.errorText}>{errors.correo}</Text> : null}

          <TextInput
            style={[styles.input, errors.telefono ? styles.inputError : null]}
            placeholder="Teléfono (10 dígitos)"
            placeholderTextColor="#999"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!loading}
          />
          {errors.telefono ? <Text style={styles.errorText}>{errors.telefono}</Text> : null}

          <TextInput
            style={[styles.input, errors.ocupacion ? styles.inputError : null]}
            placeholder="Ocupación"
            placeholderTextColor="#999"
            value={ocupacion}
            onChangeText={setOcupacion}
            editable={!loading}
          />
          {errors.ocupacion ? <Text style={styles.errorText}>{errors.ocupacion}</Text> : null}

          <Pressable 
            style={({ pressed }) => [
              styles.loginButton, 
              pressed && styles.loginButtonPressed,
              loading && styles.loginButtonDisabled
            ]} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.loginButtonText}>Registrarse</Text>
              </>
            )}
          </Pressable>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
              ¿Ya tienes una cuenta? Inicia Sesión
            </Text>
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
    height: '55%',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#ffbe00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightColumn: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  welcomeText: {
    fontFamily: 'MiFuente',
    fontSize: 30,
    color: '#000',
    textAlign: 'center',
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  input: {
    height: 45,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 5,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  loginButton: {
    backgroundColor: '#ffbe00',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#ffbe00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  loginButtonPressed: {
    backgroundColor: '#9a1a22',
  },
  loginButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 10,
  },
  linkText: {
    color: '#ffbe00',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  linkTextDisabled: {
    color: '#999',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
  },
  image: {
    width: '80%',
    height: '80%',
  },
});

export default RegisterScreen;
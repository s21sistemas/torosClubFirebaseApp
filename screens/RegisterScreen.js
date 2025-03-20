import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Image, Pressable, Platform } from 'react-native';
import { db, auth } from '../firebaseConfig'; // Importa Firestore y Auth
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'; // Importa funciones de Firestore
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Importa función de autenticación

const RegisterScreen = ({ navigation }) => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ocupacion, setOcupacion] = useState('');
  const [errors, setErrors] = useState({
    nombreCompleto: '',
    correo: '',
    telefono: '',
    ocupacion: '',
  });

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
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

  // Función para generar un código de 6 dígitos
  const generateRandomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Genera un número de 6 dígitos
  };

  // Función para verificar si el código ya existe en Firestore
  const isCodeUnique = async (code) => {
    const q = query(collection(db, 'usuarios'), where('codigo_acceso', '==', code));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty; // Devuelve true si el código es único
  };

  const handleRegister = async () => {
    if (validateForm()) {
      try {
        // Generar un código único
        let codigoAcceso;
        let isUnique = false;

        while (!isUnique) {
          codigoAcceso = generateRandomCode();
          isUnique = await isCodeUnique(codigoAcceso);
        }

        // Crear usuario en Firebase Authentication con el código como contraseña
        const userCredential = await createUserWithEmailAndPassword(auth, correo, codigoAcceso);
        const user = userCredential.user;

        // Datos del usuario para guardar en Firestore
        const userData = {
          uid: user.uid, // Guarda el UID del usuario
          nombre_completo: nombreCompleto,
          correo,
          celular: telefono,
          ocupacion,
          codigo_acceso: codigoAcceso, // Guarda el código de acceso
          fecha_registro: new Date().toISOString(),
        };

        // Guardar los datos en Firestore
        await addDoc(collection(db, 'usuarios'), userData);

        showAlert('Éxito', `Usuario registrado correctamente. Tu código de acceso es: ${codigoAcceso}`);
        navigation.navigate('Login');
      } catch (err) {
        console.error('Error al registrar el usuario:', err);
        showAlert('Error', err.message || 'Error al registrar el usuario. Por favor, inténtalo de nuevo.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.rectangle}>
        <View style={styles.leftColumn}>
          <Image
            source={require('../assets/logo.jpg')}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.welcomeText}>Registro</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre Completo"
            placeholderTextColor="#999"
            value={nombreCompleto}
            onChangeText={setNombreCompleto}
          />
          {errors.nombreCompleto ? <Text style={styles.errorText}>{errors.nombreCompleto}</Text> : null}

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
            placeholder="Teléfono"
            placeholderTextColor="#999"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />
          {errors.telefono ? <Text style={styles.errorText}>{errors.telefono}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Ocupación"
            placeholderTextColor="#999"
            value={ocupacion}
            onChangeText={setOcupacion}
          />
          {errors.ocupacion ? <Text style={styles.errorText}>{errors.ocupacion}</Text> : null}

          <Pressable style={styles.loginButton} onPress={handleRegister}>
            <Text style={styles.loginButtonText}>Registrarse</Text>
          </Pressable>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>¿Ya tienes una cuenta? Inicia Sesión</Text>
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
    width: '80%',
    height: 500,
    borderRadius: 10,
    overflow: 'hidden',
  },
  leftColumn: {
    flex: 1,
    backgroundColor: '#FBBE08',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightColumn: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  welcomeText: {
    fontFamily: 'MiFuente',
    fontSize: 40,
    color: '#000',
    textAlign: 'center',
    paddingBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 5,
    paddingHorizontal: 10,
  },
  loginButton: {
    backgroundColor: '#FBBE08',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  linkText: {
    color: '#FBBE08',
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

export default RegisterScreen;
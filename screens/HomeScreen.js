import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput,
  Animated, Platform, PanResponder, Linking, ActivityIndicator,
  Image, Button, SafeAreaView, ScrollView, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { getStorage, ref, uploadBytes, getDownloadURL,uploadString } from 'firebase/storage';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth } from '../firebaseConfig';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';

// Configuración de Firebase
import { app } from '../firebaseConfig';

const storage = getStorage(app);
const db = getFirestore(app);

const HomeScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_p: '',
    apellido_m: '',
    sexo: '',
    categoria: '',
    direccion: '',
    telefono: '',
    fecha_nacimiento: new Date(),
    lugar_nacimiento: '',
    curp: '',
    grado_escolar: '',
    nombre_escuela: '',
    alergias: '',
    padecimientos: '',
    peso: '',
    tipo_inscripcion: '',
    foto_jugador: null,
    firma: [],
    activo: 'no activo',
    numero_mfl: '000000',
    documentos: {
      ine_tutor: null,
      curp_jugador: null,
      acta_nacimiento: null,
      comprobante_domicilio: null,
      firma: null
    },
    transferencia: {
      club_anterior: '',
      temporadas_jugadas: '',
      motivo_transferencia: ''
    }, 
    temporadaId: {
      label:'',
      value:''
    }
  });

  const [errors, setErrors] = useState({});
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [currentUpload, setCurrentUpload] = useState(null);
  const signatureRef = useRef(null);
  const [acceptedRegulation, setAcceptedRegulation] = useState(false);

  const steps = [
    'GeneroForm',
    'TipoInscripcionForm',
    'DatosPersonalesForm',
    'DatosContactoForm',
    'DatosEscolaresMedicosForm',
    ...(formData.tipo_inscripcion === 'transferencia' ? ['TransferenciaForm'] : []),
    'FirmaFotoForm'
  ];

  const uploadFile = async (fileUri) => {
  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const fileName = `image_${Date.now()}.jpg`;
    const storage = getStorage();
    const storageRef = ref(storage, `fotos/${fileName}`);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error al subir imagen:", error);
    throw new Error("No se pudo subir la imagen a Firebase.");
  }
};

const uploadFile1 = async (fileUri, fileName = 'image.jpg', folder = 'fotos') => {
  try {
    // 1. Leer imagen como base64
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Crear referencia en Firebase Storage
    const storage = getStorage();
    const storageRef = ref(storage, `${folder}/${Date.now()}_${fileName}`);

    // 3. Subir como string base64 con tipo especificado
    await uploadString(storageRef, base64Data, 'base64', {
      contentType: 'image/jpeg'
    });

    // 4. Obtener URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;

  } catch (error) {
    console.error('Error al subir imagen:', error);
    throw new Error('No se pudo subir la imagen usando base64.');
  }
};


  const validateForm = () => {
    const newErrors = {};
    
    switch (steps[currentStep]) {
      case 'GeneroForm':
        if (!formData.sexo) {
          newErrors.sexo = 'Selecciona un género';
        }
        break;
      case 'TipoInscripcionForm':
        if (!formData.tipo_inscripcion) {
          newErrors.tipo_inscripcion = 'Selecciona un tipo de inscripción';
        }
        break;
      case 'DatosPersonalesForm':
        if (!formData.nombre) newErrors.nombre = 'Nombre es requerido';
        if (!formData.apellido_p) newErrors.apellido_p = 'Apellido paterno es requerido';
        break;
      case 'FirmaFotoForm':
        if (!formData.foto_jugador) newErrors.foto_jugador = 'Sube una foto del jugador';
        if (!acceptedRegulation) newErrors.regulation = 'Debes aceptar el reglamento';
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateForm()) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep((prev) => prev + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handlePreviousStep = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep((prev) => prev - 1);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

 const handleSubmit = async () => {
  if (!validateForm()) {
    Alert.alert('Error', 'Por favor completa todos los campos requeridos');
    return;
  }

  setLoading(true);

  try {
    // 1. Verificar autenticación
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No se pudo verificar tu sesión. Vuelve a iniciar sesión.');
    }
    const uid = user.uid;

    // 2. Subir foto del jugador con reintentos
    let fotoJugadorURL = null;
    if (formData.foto_jugador) {
      try {
        fotoJugadorURL = await withRetry(
          () => uploadFile(formData.foto_jugador),
          3,
          1000
        );

        if (!fotoJugadorURL) {
          throw new Error("La URL de la imagen no se pudo obtener.");
        }
      } catch (uploadError) {
        console.error('Error al subir foto después de varios intentos:', uploadError);
        throw new Error('No se pudo subir la foto. Intenta con otra imagen o verifica tu conexión.');
      }
    }

    // 3. Obtener temporada activa
    let temporadaActiva = null;
    try {
      const temporadasQuery = query(
        collection(db, 'temporadas'),
        where('estado_temporada', '==', 'Activa')
      );

      const temporadasSnapshot = await getDocs(temporadasQuery);
      if (!temporadasSnapshot.empty) {
        const tempDoc = temporadasSnapshot.docs[0];
        temporadaActiva = {
          label: tempDoc.data().temporada || 'Temporada Activa',
          value: tempDoc.id
        };
      }
    } catch (dbError) {
      console.error('Error al obtener temporada activa:', dbError);
    }

    // 4. Crear objeto de registro
    const datosRegistro = {
      nombre: formData.nombre,
      apellido_p: formData.apellido_p,
      apellido_m: formData.apellido_m,
      sexo: formData.sexo,
      categoria: formData.categoria,
      direccion: formData.direccion,
      telefono: formData.telefono,
      fecha_nacimiento: formData.fecha_nacimiento.toISOString().split('T')[0],
      lugar_nacimiento: formData.lugar_nacimiento,
      curp: formData.curp,
      grado_escolar: formData.grado_escolar,
      nombre_escuela: formData.nombre_escuela,
      alergias: formData.alergias,
      padecimientos: formData.padecimientos,
      peso: formData.peso,
      tipo_inscripcion: formData.tipo_inscripcion,
      foto: fotoJugadorURL,
      documentos: {
        ine_tutor: null,
        curp: null,
        acta_nacimiento: null,
        comprobante_domicilio: null,
        firma: null,
        firma_jugador: null
      },
      activo: 'activo',
      numero_mfl: formData.numero_mfl,
      fecha_registro: new Date(),
      uid: uid,
      estatus: "Incompleto",
      ...(temporadaActiva && { temporada: temporadaActiva }),
      ...(formData.tipo_inscripcion === 'transferencia' && {
        transferencia: formData.transferencia
      })
    };

    // 5. Guardar en Firestore
    const coleccion = formData.tipo_inscripcion === 'porrista' ? 'porristas' : 'jugadores';
    const docRef = await addDoc(collection(db, coleccion), datosRegistro);

    // 6. Procesar pagos
    await processPayments(docRef.id, formData, temporadaActiva);

    // 7. Éxito
    Alert.alert(
      'Registro Exitoso',
      'Jugador registrado correctamente. Se ha creado el expediente y los pagos correspondientes.',
      [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]
    );

  } catch (error) {
    console.error('Error completo en handleSubmit:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      user: auth.currentUser?.uid,
      formData: {
        ...formData,
        foto_jugador: formData.foto_jugador ? 'EXISTE' : 'NULL',
        firma: formData.firma.length > 0 ? 'EXISTE' : 'NULL'
      }
    });

    let errorMessage = error.message || 'Ocurrió un error al completar el registro.';

    if (error.message.includes('network') || error.message.includes('Network')) {
      errorMessage = 'Problema de conexión. Verifica tu internet e intenta nuevamente.';
    } else if (error.message.includes('quota')) {
      errorMessage = 'Límite de almacenamiento excedido. Contacta al administrador.';
    } else if (error.message.includes('permission')) {
      errorMessage = 'No tienes permisos para realizar esta acción.';
    }

    Alert.alert('Error', errorMessage);
  } finally {
    setLoading(false);
    setCurrentUpload(null);
  }
};


// Funciones auxiliares:

// Verificar conexión a internet


// Función con reintentos automáticos
const withRetry = async (fn, maxRetries = 3, delayMs = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
};

// Procesar pagos (separado para mejor organización)
const processPayments = async (playerId, formData, temporadaActiva) => {
  try {
    const costosCollection = formData.tipo_inscripcion === 'porrista' ? 'costos-porrista' : 'costos-jugador';
    const costosQuery = collection(db, costosCollection);
    const costosSnapshot = await getDocs(costosQuery);
    
    if (costosSnapshot.empty) {
      throw new Error(`No se encontraron costos configurados para ${formData.tipo_inscripcion}`);
    }

    const costosDoc = costosSnapshot.docs[0];
    const costosData = costosDoc.data();
    const parseCost = (value) => parseInt(value || '0', 10);
    
    const nombreCompleto = `${formData.nombre} ${formData.apellido_p} ${formData.apellido_m}`;
    const fechaActual = new Date();
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 7);

    if (formData.tipo_inscripcion === 'porrista') {
      const inscripcion = parseCost(costosData.inscripcion);
      const coaching = parseCost(costosData.coaching);
      const total = inscripcion + coaching;

      const pagosPorrista = {
        porristaId: playerId,
        nombre: nombreCompleto,
        pagos: [
          {
            tipo: 'Inscripción',
            estatus: 'pendiente',
            fecha_pago: null,
            monto: inscripcion,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0,
            fecha_limite: fechaLimite.toISOString().split('T')[0]
          },
          {
            tipo: 'Coaching',
            estatus: 'pendiente',
            fecha_pago: null,
            monto: coaching,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0,
            fecha_limite: null
          }
        ],
        monto_total_pagado: 0,
        monto_total_pendiente: total,
        monto_total: total,
        fecha_registro: fechaActual.toISOString().split('T')[0],
        temporadaId: temporadaActiva?.value || costosData.temporadaId?.value || null
      };
      await addDoc(collection(db, 'pagos_porristas'), pagosPorrista);
    } else {
      const inscripcion = parseCost(costosData.inscripcion);
      const coaching = parseCost(costosData.coaching);
      const tunel = parseCost(costosData.tunel);
      const botiquin = parseCost(costosData.botiquin);
      const equipamiento = parseCost(costosData.equipamiento);
      const pesaje = parseCost(costosData.pesaje);
      
      const total = inscripcion + coaching + tunel + botiquin + equipamiento + pesaje;

      const pagosJugador = {
        jugadorId: playerId,
        nombre: nombreCompleto,
        categoria: formData.categoria,
        pagos: [
          {
            tipo: 'Inscripción',
            beca: '0',
            descuento: '0',
            estatus: 'pendiente',
            fecha_pago: null,
            submonto: 0,
            monto: inscripcion,
            prorroga: false,
            fecha_limite: fechaLimite.toISOString().split('T')[0],
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          },
          {
            tipo: 'Coaching',
            estatus: 'pendiente',
            fecha_pago: null,
            fecha_limite: null,
            monto: coaching,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          },
          {
            tipo: 'Túnel',
            estatus: 'pendiente',
            fecha_pago: null,
            monto: tunel,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          },
          {
            tipo: 'Botiquín',
            estatus: 'pendiente',
            fecha_pago: null,
            monto: botiquin,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          },
          {
            tipo: 'Equipamiento',
            estatus: 'pendiente',
            fecha_pago: null,
            fecha_limite: null,
            monto: equipamiento,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          },
          {
            tipo: 'Pesaje',
            estatus: 'pendiente',
            fecha_pago: null,
            monto: pesaje,
            metodo_pago: null,
            abono: 'NO',
            abonos: [],
            total_abonado: 0
          }
        ],
        monto_total_pagado: 0,
        monto_total_pendiente: total,
        monto_total: total,
        fecha_registro: fechaActual.toISOString().split('T')[0],
        temporadaId: temporadaActiva?.value || costosData.temporadaId?.value || null
      };
      await addDoc(collection(db, 'pagos_jugadores'), pagosJugador);
    }
  } catch (error) {
    console.error('Error al procesar pagos:', error);
    throw new Error('Se completó el registro pero hubo un problema con los pagos. Contacta al administrador.');
  }
};

  const renderForm = () => {
    switch (steps[currentStep]) {
      case 'GeneroForm':
        return <GeneroForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'TipoInscripcionForm':
        return <TipoInscripcionForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} navigation={navigation} />;
      case 'DatosPersonalesForm':
        return <DatosPersonalesForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} db={db} />;
      case 'DatosContactoForm':
        return <DatosContactoForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosEscolaresMedicosForm':
        return <DatosEscolaresMedicosForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'TransferenciaForm':
        return <TransferenciaForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'FirmaFotoForm':
        return <FirmaFotoForm 
          formData={formData} 
          setFormData={setFormData} 
          errors={errors} 
          onNext={handleSubmit} 
          acceptedRegulation={acceptedRegulation}
          setAcceptedRegulation={setAcceptedRegulation}
        />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        {renderForm()}
      </Animated.View>
      {currentStep > 0 && currentStep !== steps.length - 1 && (
        <TouchableOpacity style={styles.backButton} onPress={handlePreviousStep}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          {currentUpload && (
            <Text style={styles.uploadingText}>
              Subiendo {currentUpload}... {Math.round(uploadProgress[currentUpload] || 0)}%
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

// Componente GeneroForm
const GeneroForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>¿Registrarás a un hombre o mujer?</Text>
      <Picker
        selectedValue={formData.sexo}
        onValueChange={(itemValue) => setFormData({ ...formData, sexo: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Selecciona un género" value="" />
        <Picker.Item label="Hombre" value="hombre" />
        <Picker.Item label="Mujer" value="mujer" />
      </Picker>
      {errors.sexo && <Text style={styles.errorText}>{errors.sexo}</Text>}
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// Componente TipoInscripcionForm
const TipoInscripcionForm = ({ formData, setFormData, errors, onNext, navigation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchError, setSearchError] = useState('');
  const [foundPlayer, setFoundPlayer] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [reinscribiendo, setReinscribiendo] = useState(false);

  const tipoInscripcionOptions = [
    { label: "Selecciona un tipo de inscripción", value: "" },
    { label: "Novato", value: "novato" },
    { label: "Reinscripción", value: "reinscripcion" },
    { label: "Transferencia", value: "transferencia" },
    ...(formData.sexo === "mujer" ? [{ label: "Porrista", value: "porrista" }] : []),
  ];

  const validateSearchTerm = (term) => {
    if (term.length === 18) return { type: 'curp', isValid: true };
    if (/^\d{6}$/.test(term)) return { type: 'mfl', isValid: true };
    return { type: null, isValid: false };
  };

  const searchPlayer = async () => {
    const validation = validateSearchTerm(searchTerm);
    if (!validation.isValid) {
      setSearchError('Ingresa un CURP (18 caracteres) o MFL (6 dígitos) válido');
      return;
    }

    setLoadingSearch(true);
    setSearchError('');
    setFoundPlayer(null);

    try {
      let q;
      if (validation.type === 'curp') {
        q = query(
          collection(db, 'jugadores'),
          where('curp', '==', searchTerm.toUpperCase()),
          where('activo', '==', 'no activo')
        );
      } else {
        q = query(
          collection(db, 'jugadores'),
          where('numero_mfl', '==', searchTerm),
          where('activo', '==', 'no activo')
        );
      }

      let qCheerleader;
      if (formData.sexo === 'mujer') {
        if (validation.type === 'curp') {
          qCheerleader = query(
            collection(db, 'porristas'),
            where('curp', '==', searchTerm.toUpperCase()),
            where('activo', '==', 'no activo')
          );
        } else {
          qCheerleader = query(
            collection(db, 'porristas'),
            where('numero_mfl', '==', searchTerm),
            where('activo', '==', 'no activo')
          );
        }
      }

      const [playersSnapshot, cheerleadersSnapshot] = await Promise.all([
        getDocs(q),
        qCheerleader ? getDocs(qCheerleader) : Promise.resolve({ empty: true }),
      ]);

      let playerData = null;
      
      if (!playersSnapshot.empty) {
        playerData = { 
          ...playersSnapshot.docs[0].data(), 
          id: playersSnapshot.docs[0].id,
          collection: 'jugadores'
        };
      } else if (!cheerleadersSnapshot.empty) {
        playerData = { 
          ...cheerleadersSnapshot.docs[0].data(), 
          id: cheerleadersSnapshot.docs[0].id,
          collection: 'porristas'
        };
      }

      if (playerData) {
        setFoundPlayer(playerData);
      } else {
        setSearchError('No se encontró un jugador/porrista con esos datos o ya está activo');
      }
    } catch (error) {
      console.error('Error al buscar jugador:', error);
      setSearchError('Error al buscar jugador. Inténtalo de nuevo.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const reinscribirPlayer = async () => {
    if (!foundPlayer) return;
  
    setReinscribiendo(true);
    
    try {
      const docRef = doc(db, foundPlayer.collection, foundPlayer.id);
      await updateDoc(docRef, {
        activo: 'activo',
        fecha_reinscripcion: new Date()
      });

      navigation.navigate('MainTabs');
    } catch (error) {
      console.error('Error al reinscribir:', error);
      Alert.alert('Error', 'No se pudo completar la reinscripción');
    } finally {
      setReinscribiendo(false);
    }
  };

  const handleTipoInscripcionChange = (itemValue) => {
    setFormData({ ...formData, tipo_inscripcion: itemValue });
    setFoundPlayer(null);
    setSearchTerm('');
    setSearchError('');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Tipo de Inscripción</Text>
        <Picker
          selectedValue={formData.tipo_inscripcion}
          onValueChange={handleTipoInscripcionChange}
          style={styles.picker}
        >
          {tipoInscripcionOptions.map((option, index) => (
            <Picker.Item key={index} label={option.label} value={option.value} />
          ))}
        </Picker>
        {errors.tipo_inscripcion && <Text style={styles.errorText}>{errors.tipo_inscripcion}</Text>}

        {formData.tipo_inscripcion === 'reinscripcion' && (
          <View style={styles.reinscripcionContainer}>
            <Text style={styles.subtitle}>Buscar jugador/porrista para reinscribir</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Ingresa CURP (18 caracteres) o MFL (6 dígitos)"
              value={searchTerm}
              onChangeText={setSearchTerm}
              maxLength={18}
              autoCapitalize="characters"
            />
            
            {searchError && <Text style={styles.errorText}>{searchError}</Text>}
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={searchPlayer}
              disabled={loadingSearch}
            >
              {loadingSearch ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Buscar</Text>
              )}
            </TouchableOpacity>

            {foundPlayer && (
              <View style={styles.playerInfoContainer}>
                <Text style={styles.playerInfoTitle}>Jugador encontrado:</Text>
                
                {foundPlayer.foto && (
                  <Image 
                    source={{ uri: foundPlayer.foto }} 
                    style={styles.playerImage}
                  />
                )}
                
                <Text style={styles.playerInfoText}>
                  Nombre: {foundPlayer.nombre} {foundPlayer.apellido_p} {foundPlayer.apellido_m}
                </Text>
                <Text style={styles.playerInfoText}>CURP: {foundPlayer.curp}</Text>
                <Text style={styles.playerInfoText}>MFL: {foundPlayer.numero_mfl || 'N/A'}</Text>
                <Text style={styles.playerInfoText}>Estado actual: {foundPlayer.activo}</Text>
                
                <TouchableOpacity 
                  style={[styles.button, styles.reinscribirButton]}
                  onPress={reinscribirPlayer}
                  disabled={reinscribiendo}
                >
                  {reinscribiendo ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Reinscribir</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {formData.tipo_inscripcion !== 'reinscripcion' && (
          <TouchableOpacity 
            style={styles.button} 
            onPress={onNext}
          >
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

// Componente DatosPersonalesForm modificado para consultar categorías desde Firestore
const DatosPersonalesForm = ({ formData, setFormData, errors, onNext, db }) => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState(
    formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento).toISOString().split('T')[0] : ''
  );
  const [loadingCategoria, setLoadingCategoria] = useState(false);
  const [temporadaInfo, setTemporadaInfo] = useState(null);

  // Función para determinar la categoría basada en la fecha de nacimiento y sexo
  const determinarCategoria = async (fechaNacimiento, sexo) => {
    if (!fechaNacimiento || !sexo) return;
    
    setLoadingCategoria(true);
    try {
      const fechaNac = new Date(fechaNacimiento);
      
      // Consultar todas las categorías para el sexo especificado
      const categoriasRef = collection(db, 'categorias');
      const q = query(categoriasRef, where('sexo', '==', sexo));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No se encontraron categorías para el sexo especificado');
        setFormData(prev => ({ 
          ...prev, 
          categoria: 'NC',
          temporadaId: null
        }));
        setTemporadaInfo(null);
        return;
      }
      
      let categoriaAsignada = 'NC'; // Por defecto si no encuentra categoría
      let tempTemporadaInfo = null;
      
      querySnapshot.forEach((doc) => {
        const categoriaData = doc.data();
        
        // Convertir las fechas de string a objetos Date
        const fechaInicio = new Date(categoriaData.fecha_inicio);
        const fechaFin = new Date(categoriaData.fecha_fin);
        
        // Verificar si la fecha de nacimiento está dentro del rango
        if (fechaNac >= fechaInicio && fechaNac <= fechaFin) {
          categoriaAsignada = categoriaData.nombre_categoria;
          tempTemporadaInfo = {
            nombre: categoriaData.temporada,
            id: categoriaData.temporadaId
          };
        }
      });
      
      setFormData(prev => ({ 
        ...prev, 
        categoria: categoriaAsignada,
        temporadaId: tempTemporadaInfo?.id || null
      }));
      
      setTemporadaInfo(tempTemporadaInfo);
    } catch (error) {
      console.error('Error al determinar categoría:', error);
      setFormData(prev => ({ 
        ...prev, 
        categoria: 'NC',
        temporadaId: null
      }));
      setTemporadaInfo(null);
    } finally {
      setLoadingCategoria(false);
    }
  };

  useEffect(() => {
    if (formData.fecha_nacimiento && formData.sexo) {
      determinarCategoria(formData.fecha_nacimiento, formData.sexo);
    }
  }, [formData.fecha_nacimiento, formData.sexo]);

  const onChangeMobile = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      updateDate(selectedDate);
    }
  };

  const updateDate = (newDate) => {
    const validDate = new Date(newDate);
    if (isNaN(validDate.getTime())) return;

    setDate(validDate);
    setDateInputValue(validDate.toISOString().split('T')[0]);
    setFormData({ ...formData, fecha_nacimiento: validDate });
  };

  const handleWebDateChange = (e) => {
    const value = e.target.value;
    setDateInputValue(value);
    
    if (value) {
      const newDate = new Date(value);
      if (!isNaN(newDate.getTime())) {
        updateDate(newDate);
      }
    }
  };

  const formatDate = (dateObj) => {
    if (!dateObj || isNaN(new Date(dateObj).getTime())) return 'Fecha inválida';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateObj).toLocaleDateString('es-MX', options);
  };

  // Función para validar formato de CURP
  const validateCurp = (curp) => {
    if (!curp) return true; // No es requerido en esta validación
    const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
    return regex.test(curp.toUpperCase());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.formContainer}
      keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Datos Personales- Jugador(a)</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre del jugador(a)"
              value={formData.nombre}
              onChangeText={(text) => setFormData({ ...formData, nombre: text })}
            />
            {errors.nombre && <Text style={styles.errorText}>{errors.nombre}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Apellido Paterno"
              value={formData.apellido_p}
              onChangeText={(text) => setFormData({ ...formData, apellido_p: text })}
            />
            {errors.apellido_p && <Text style={styles.errorText}>{errors.apellido_p}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Apellido Materno"
              value={formData.apellido_m}
              onChangeText={(text) => setFormData({ ...formData, apellido_m: text })}
            />
            {errors.apellido_m && <Text style={styles.errorText}>{errors.apellido_m}</Text>}

            {/* Nuevo campo CURP */}
            <TextInput
              style={styles.input}
              placeholder="CURP (18 caracteres)"
              value={formData.curp}
              onChangeText={(text) => {
                setFormData({ ...formData, curp: text.toUpperCase() });
                // Validación en tiempo real
                if (text && !validateCurp(text)) {
                  setFormData(prev => ({ 
                    ...prev, 
                    curpError: 'Formato de CURP inválido' 
                  }));
                } else {
                  setFormData(prev => ({ 
                    ...prev, 
                    curpError: null 
                  }));
                }
              }}
              maxLength={18}
              autoCapitalize="characters"
            />
            {errors.curp && <Text style={styles.errorText}>{errors.curp}</Text>}
            {formData.curpError && <Text style={styles.errorText}>{formData.curpError}</Text>}

            <Text style={styles.label}>Fecha de Nacimiento:</Text>
            
            {Platform.OS !== 'web' ? (
              <>
                <Button 
                  title={date ? formatDate(date) : "Seleccionar fecha"} 
                  onPress={() => setShowPicker(true)} 
                />
                {showPicker && (
                  <DateTimePicker
                    value={date || new Date()}
                    mode="date"
                    display="default"
                    onChange={onChangeMobile}
                    maximumDate={new Date()}
                  />
                )}
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={dateInputValue}
                  onChange={handleWebDateChange}
                  style={styles.webInput}
                  max={new Date().toISOString().split('T')[0]}
                />
                {errors.fecha_nacimiento && (
                  <Text style={styles.errorText}>{errors.fecha_nacimiento}</Text>
                )}
              </>
            )}

            <Text style={styles.selectedDate}>
              Fecha seleccionada: {formatDate(date)}
            </Text>

            {loadingCategoria ? (
              <View style={styles.categoriaContainer}>
                <ActivityIndicator size="small" color="#0000ff" />
                <Text style={styles.categoriaText}>Determinando categoría...</Text>
              </View>
            ) : formData.categoria ? (
              <View style={styles.categoriaContainer}>
                <Text style={styles.categoriaText}>
                  Categoría asignada: <Text style={styles.categoriaValue}>{formData.categoria}</Text>
                </Text>
                
                {temporadaInfo && (
                  <Text style={styles.temporadaText}>
                    Temporada: <Text style={styles.temporadaValue}>{temporadaInfo.nombre}</Text>
                  </Text>
                )}
                
                {formData.categoria === 'NC' && (
                  <Text style={styles.categoriaNota}>*El jugador está fuera de los rangos de edad permitidos</Text>
                )}
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Lugar de Nacimiento"
              value={formData.lugar_nacimiento}
              onChangeText={(text) => setFormData({ ...formData, lugar_nacimiento: text })}
            />
            {errors.lugar_nacimiento && <Text style={styles.errorText}>{errors.lugar_nacimiento}</Text>}

            <TouchableOpacity style={styles.button} onPress={onNext}>
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// Componente DatosContactoForm
const DatosContactoForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.formContainer}
      keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Datos de Contacto</Text>
          <TextInput
            style={styles.input}
            placeholder="Dirección"
            value={formData.direccion}
            onChangeText={(text) => setFormData({ ...formData, direccion: text })}
          />
          {errors.direccion && <Text style={styles.errorText}>{errors.direccion}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            value={formData.telefono}
            onChangeText={(text) => setFormData({ ...formData, telefono: text })}
            keyboardType="phone-pad"
          />
          {errors.telefono && <Text style={styles.errorText}>{errors.telefono}</Text>}
          <TouchableOpacity style={styles.button} onPress={onNext}>
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// Componente DatosEscolaresMedicosForm
const DatosEscolaresMedicosForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.formContainer}
      keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Datos Escolares y Médicos</Text>
            <Picker
              selectedValue={formData.grado_escolar}
              onValueChange={(itemValue) => setFormData({ ...formData, grado_escolar: itemValue })}
              style={styles.picker}
            >
              <Picker.Item label="Selecciona el grado escolar" value="" />
              <Picker.Item label="Primaria" value="primaria" />
              <Picker.Item label="Secundaria" value="secundaria" />
              <Picker.Item label="Preparatoria" value="preparatoria" />
            </Picker>
            {errors.grado_escolar && <Text style={styles.errorText}>{errors.grado_escolar}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Nombre de la Escuela"
              value={formData.nombre_escuela}
              onChangeText={(text) => setFormData({ ...formData, nombre_escuela: text })}
            />
            {errors.nombre_escuela && <Text style={styles.errorText}>{errors.nombre_escuela}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Alergias"
              value={formData.alergias}
              onChangeText={(text) => setFormData({ ...formData, alergias: text })}
            />
            {errors.alergias && <Text style={styles.errorText}>{errors.alergias}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Padecimientos"
              value={formData.padecimientos}
              onChangeText={(text) => setFormData({ ...formData, padecimientos: text })}
            />
            {errors.padecimientos && <Text style={styles.errorText}>{errors.padecimientos}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Peso (kg)"
              value={formData.peso}
              onChangeText={(text) => setFormData({ ...formData, peso: text })}
              keyboardType="numeric"
            />
            {errors.peso && <Text style={styles.errorText}>{errors.peso}</Text>}
            <TouchableOpacity style={styles.button} onPress={onNext}>
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// Componente TransferenciaForm
const TransferenciaForm = ({ formData, setFormData, errors, onNext }) => {
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      transferencia: {
        ...prev.transferencia,
        [field]: value
      }
    }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.formContainer}
      keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Datos de Transferencia</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Club de Origen"
            value={formData.transferencia.club_anterior}
            onChangeText={(text) => handleChange('club_anterior', text)}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Temporadas Jugadas"
            value={formData.transferencia.temporadas_jugadas}
            onChangeText={(text) => handleChange('temporadas_jugadas', text)}
            keyboardType="numeric"
          />
          
          <Picker
            selectedValue={formData.transferencia.motivo_transferencia}
            onValueChange={(itemValue) => handleChange('motivo_transferencia', itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Selecciona un motivo de transferencia" value="" />
            <Picker.Item label="Préstamo" value="prestamo" />
            <Picker.Item label="Cambio de domicilio" value="cambio_domicilio" />
            <Picker.Item label="Descanso" value="descanso" />
            <Picker.Item label="Transferencia definitiva" value="transferencia_definitiva" />
          </Picker>
          
          <TouchableOpacity style={styles.button} onPress={onNext}>
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// Componente FirmaFotoForm
const FirmaFotoForm = ({ formData, setFormData, errors, onNext, acceptedRegulation, setAcceptedRegulation }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasGalleryPermission, setHasGalleryPermission] = useState(null);

  useEffect(() => {
    (async () => {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');
      setHasGalleryPermission(galleryStatus.status === 'granted');
    })();
  }, []);

  const handleSelectFoto = async () => {
    if (!hasGalleryPermission) {
      Alert.alert('Permisos denegados', 'Necesitas permitir el acceso a la galería para seleccionar una imagen.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setFormData((prevData) => ({ ...prevData, foto_jugador: uri }));
      }
    } catch (error) {
      console.error('Error al seleccionar la foto:', error);
    }
  };

  const handleTakePhoto = async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permisos denegados', 'Necesitas permitir el acceso a la cámara para tomar una foto.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        aspect: [4, 3],
        quality: 0.3,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setFormData((prevData) => ({ ...prevData, foto_jugador: uri }));
      }
    } catch (error) {
      console.error('Error al tomar la foto:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.formContainer}
      keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Foto del Jugador</Text>
            
            {formData.foto_jugador && (
              <Image
                source={{ uri: formData.foto_jugador }}
                style={styles.imagePreview}
              />
            )}
            <View style={styles.photoButtonsContainer}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleTakePhoto}>
                <Text style={styles.secondaryButtonText}>Tomar Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSelectFoto}>
                <Text style={styles.secondaryButtonText}>Seleccionar de Galería</Text>
              </TouchableOpacity>
            </View>
            {errors.foto_jugador && <Text style={styles.errorText}>{errors.foto_jugador}</Text>}
            
            {/* Sección de aceptación del reglamento */}
            <View style={styles.regulationContainer}>
              <Text style={styles.regulationTitle}>Reglamento del Equipo</Text>
              
              <TouchableOpacity 
                onPress={() => Linking.openURL('https://firebasestorage.googleapis.com/v0/b/clubpotros-f28a5.firebasestorage.app/o/logos%2FReglamentoPotros.pdf?alt=media&token=5c87023d-c8b3-42be-b0d9-5b167a7ead0c')} 
                style={styles.regulationLink}
              >
                <Text style={styles.regulationLinkText}>Descargue, lea y firme el reglamento</Text>
              </TouchableOpacity>
              
              <View style={styles.checkboxContainer}>
                <TouchableOpacity 
                  style={[styles.checkbox, acceptedRegulation && styles.checkboxChecked]}
                  onPress={() => setAcceptedRegulation(!acceptedRegulation)}
                >
                  {acceptedRegulation && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.regulationText}>
                  Confirmo que he leído y acepto el reglamento del equipo
                </Text>
              </View>
              {errors.regulation && <Text style={styles.errorText}>{errors.regulation}</Text>}
            </View>

            <TouchableOpacity 
              style={[
                styles.button,
                (!acceptedRegulation || !formData.foto_jugador) && styles.disabledButton
              ]} 
              onPress={onNext}
              disabled={!acceptedRegulation || !formData.foto_jugador}
            >
              <Text style={styles.buttonText}>Finalizar Registro</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 35,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#ffbe00',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#e1e1e1',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ffbe00',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#ffbe00',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 25,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#ffbe00',
    padding: 15,
    borderRadius: 5,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signatureContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 10,
    backgroundColor: 'white',
  },
  canvas: {
    flex: 1,
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignSelf: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  linkText: {
    color: '#007BFF',
    textDecorationLine: 'underline',
    marginBottom: 15,
    fontSize: 16,
  },
  selectedDate: {
    fontSize: 16,
    marginBottom: 15,
    color: '#555555',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  uploadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333333',
  },
  reinscripcionContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  playerInfoContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dddddd',
  },
  playerInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  playerInfoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#555555',
  },
  playerImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    alignSelf: 'center',
  },
  reinscribirButton: {
    backgroundColor: '#4CAF50',
    marginTop: 15,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  uploadButton: {
    backgroundColor: '#ffbe00',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  fileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  fileName: {
    fontSize: 14,
    color: 'green',
    marginLeft: 5,
    flex: 1,
  },
  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#007BFF',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  uploadPendingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  uploadSuccessText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ffbe00',
  },
  webInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    width: '100%',
  },
  categoriaContainer: {
    marginTop: 10,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#4682b4',
  },
  categoriaText: {
    fontSize: 16,
    color: '#333',
  },
  categoriaValue: {
    fontWeight: 'bold',
    color: '#2e8b57',
  },
  categoriaNota: {
    fontSize: 14,
    color: '#ff8c00',
    marginTop: 5,
    fontStyle: 'italic',
  },
  regulationContainer: {
    marginTop: 25,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  regulationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  regulationLink: {
    marginBottom: 15,
  },
  regulationLinkText: {
    color: '#007BFF',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007BFF',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007BFF',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  regulationText: {
    fontSize: 16,
    color: '#495057',
    flex: 1,
  },
  categoriaContainer: {
    marginTop: 10,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#4682b4',
  },
  categoriaText: {
    fontSize: 16,
    color: '#333',
  },
  categoriaValue: {
    fontWeight: 'bold',
    color: '#2e8b57',
  },
  categoriaNota: {
    fontSize: 14,
    color: '#ff8c00',
    marginTop: 5,
    fontStyle: 'italic',
  },
  temporadaText: {
    fontSize: 16,
    marginTop: 5,
    color: '#333',
  },
  temporadaValue: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
});

export default HomeScreen;
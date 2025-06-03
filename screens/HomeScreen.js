import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput,
  Animated, Platform, PanResponder, Linking, ActivityIndicator,
  Image, Button, SafeAreaView, ScrollView, KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { app } from '../firebaseConfig'; 
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// Configuración de Firebase
//ffbe00
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

const HomeScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_p: '',
    apellido_m: '',
    sexo: '',
    categoria:'',
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
    }
  });

  const [errors, setErrors] = useState({});
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [currentUpload, setCurrentUpload] = useState(null);
  const signatureRef = useRef(null);
  const [categoria, setCategoria] = useState(null);
  const steps = [
    'GeneroForm',
    'TipoInscripcionForm',
    'DatosPersonalesForm',
    'DatosContactoForm',
    'DatosEscolaresMedicosForm',
    ...(formData.tipo_inscripcion === 'transferencia' ? ['TransferenciaForm'] : []),
    'FirmaFotoForm',
    'DocumentacionForm',
  ];

  
const safeUploadFile = async ({ uri, name, folder, type = null }) => {
  try {
    if (!uri || !name || !folder) {
      throw new Error('Parámetros insuficientes para la carga del archivo');
    }

    console.log(`Subiendo archivo: ${name} desde ${uri.substring(0, 50)}...`);

    let blob;
    
    // Para datos URI (como la firma)
    if (uri.startsWith('data:')) {
      const response = await fetch(uri);
      blob = await response.blob();
    } 
    // Para Android
    else if (Platform.OS === 'android' && uri.startsWith('content://')) {
      const cacheFileUri = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.copyAsync({ from: uri, to: cacheFileUri });
      const response = await fetch(`file://${cacheFileUri}`);
      blob = await response.blob();
    } 
    // Para web
    else if (Platform.OS === 'web') {
      const response = await fetch(uri);
      blob = await response.blob();
    } 
    // Para iOS y otros casos
    else {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('El archivo no existe en la ruta especificada');
      const response = await fetch(uri);
      blob = await response.blob();
    }

    if (!blob) {
      throw new Error('No se pudo crear el blob del archivo');
    }

    const fileExtension = name.split('.').pop() || (blob.type?.split('/')?.[1] || 'jpg');
    const mimeType = type || blob.type || 'application/octet-stream';
    const fullPath = `${folder}/${Date.now()}_${name}`;
    const storageRef = ref(storage, fullPath);

    const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: mimeType });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [folder]: progress }));
        },
        (error) => {
          console.error('Error durante la subida:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`Archivo subido con éxito: ${downloadURL}`);
            resolve(downloadURL);
          } catch (e) {
            console.error('Error al obtener URL de descarga:', e);
            reject(e);
          }
        }
      );
    });

  } catch (error) {
    console.error('Error en safeUploadFile:', {
      error: error.message,
      uri: uri?.substring(0, 100),
      name,
      folder
    });
    throw error;
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
        if (!formData.curp || formData.curp.length !== 18) newErrors.curp = 'CURP debe tener 18 caracteres';
        break;
      case 'FirmaFotoForm':
        if (formData.firma.length === 0) newErrors.firma = 'Captura tu firma';
        if (!formData.foto_jugador) newErrors.foto_jugador = 'Sube una foto del jugador';
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

  const captureSignature = async () => {
  if (!signatureRef.current) return null;
  
  try {
    // Crear un canvas temporal para la firma
    const canvas = await signatureRef.current.toDataURL();
    
    // En Android/iOS necesitamos convertir el data URL a un blob
    if (Platform.OS !== 'web') {
      const response = await fetch(canvas);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    
    return canvas;
  } catch (error) {
    console.error('Error al capturar firma:', error);
    return null;
  }
};
  

  const handleSelectFile = async (field) => {
    try {
      let result;
      
      if (Platform.OS === 'web') {
        // Implementación para web
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.jpg,.jpeg,.png';
          
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
              setFormData(prev => ({
                ...prev,
                documentos: {
                  ...prev.documentos,
                  [field]: {
                    uri: URL.createObjectURL(file),
                    name: file.name,
                    type: file.type
                  }
                }
              }));
            }
            resolve();
          };
          
          input.click();
        });
      } else {
        // Implementación para móvil
        result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFormData(prev => ({
          ...prev,
          documentos: {
            ...prev.documentos,
            [field]: {
              uri: file.uri,
              name: file.name,
              type: file.mimeType
            }
          }
        }));
      }
    } catch (error) {
      console.error('Error al seleccionar archivo:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

    const showAlert = (title, message, options) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (options && options[0] && options[0].onPress) {
        options[0].onPress();
      }
    } else {
      Alert.alert(title, message, options);
    }
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

      // 2. Subir archivos
      let fotoJugadorURL = null;
      if (formData.foto_jugador?.uri) {
        setCurrentUpload('Foto del jugador');
        fotoJugadorURL = await safeUploadFile({
          uri: formData.foto_jugador.uri,
          name: formData.foto_jugador.name || 'foto_jugador.jpg',
          folder: 'fotos',
          type: formData.foto_jugador.type || 'image/jpeg'
        });
      }

      // 3. Subir documentos
      const documentosSubidos = {};
      const documentosFields = ['ine_tutor', 'curp_jugador', 'acta_nacimiento', 'comprobante_domicilio'];
      
      for (const field of documentosFields) {
        if (formData.documentos[field]?.uri) {
          setCurrentUpload(`Documento ${field}`);
          documentosSubidos[field] = await safeUploadFile({
            uri: formData.documentos[field].uri,
            name: formData.documentos[field].name || `${field}.pdf`,
            folder: 'documentos',
            type: formData.documentos[field].type || 'application/pdf'
          });
        }
      }

      // 4. Subir firma si existe
      let firmaURL = null;
      if (formData.firma.length > 0) {
        setCurrentUpload('Firma');
        const signatureImage = await captureSignature();
        if (signatureImage) {
          firmaURL = await safeUploadFile({
            uri: signatureImage,
            name: 'firma.png',
            folder: 'firmas',
            type: 'image/png'
          });
        }
      }

      // 5. Obtener temporada activa
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
          console.log("TEMPORADA", temporadaActiva);
        }
      } catch (dbError) {
        console.error('Error al obtener temporada activa:', dbError);
      }

      // 6. Crear objeto de registro
      const datosRegistro = {
        nombre: formData.nombre,
        apellido_p: formData.apellido_p,
        apellido_m: formData.apellido_m,
        sexo: formData.sexo,
        categoria: formData.tipo_inscripcion === 'porrista' ? '' : formData.categoria,
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
          ...documentosSubidos,
          firma: firmaURL
        },
        activo: 'activo',
        numero_mfl: formData.numero_mfl,
        fecha_registro: new Date(),
        uid: uid,
        estatus: "Completa",
        ...(temporadaActiva && { temporadaId: temporadaActiva }),
        ...(formData.tipo_inscripcion === 'transferencia' && {
          transferencia: formData.transferencia
        })
      };
      console.log(datosRegistro);

      // 7. Guardar en Firestore
      const coleccion = formData.tipo_inscripcion === 'porrista' ? 'porristas' : 'jugadores';
      const docRef = await addDoc(collection(db, coleccion), datosRegistro);

      // 8. Procesar pagos
      await processPayments(docRef.id, formData, temporadaActiva);
    
    showAlert(
    'Registro Exitoso',
    'Jugador registrado correctamente',
    [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]

  );

    } catch (error) {
      console.error('Error completo en handleSubmit:', error);
      Alert.alert('Error', error.message || 'Ocurrió un error al completar el registro');
    } finally {
      setLoading(false);
      setCurrentUpload(null);
    }
  };

  // Procesar pagos (separado para mejor organización)
  const processPayments = async (playerId, formData, temporadaActiva) => {
    try {
      const costosCollection = formData.tipo_inscripcion === 'porrista' ? 'costos-porrista' : 'costos-jugador';
      const costosQuery = query(
        collection(db, costosCollection),
        where('temporadaId', '==', temporadaActiva),
         where('categoria', '==', formData.categoria)
      );
      
      const costosSnapshot = await getDocs(costosQuery);
      console.log(costosCollection);
           console.log(costosQuery);
      console.log(costosSnapshot);

      
      
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
          temporadaId: temporadaActiva || costosData.temporadaId || null
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
            }
            
          ],//https://play.google.com/apps/test/com.mx.s1sistem.ClubToros/3
          monto_total_pagado: 0,
          monto_total_pendiente: total,
          monto_total: total,
          fecha_registro: fechaActual.toISOString().split('T')[0],
          temporadaId: temporadaActiva || costosData.temporadaId || null
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
        return <DatosPersonalesForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosContactoForm':
        return <DatosContactoForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosEscolaresMedicosForm':
        return <DatosEscolaresMedicosForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'TransferenciaForm':
        return <TransferenciaForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'FirmaFotoForm':
        return <FirmaFotoForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} signatureRef={signatureRef} />;
      case 'DocumentacionForm':
        return <DocumentacionForm 
          formData={formData} 
          setFormData={setFormData} 
          onSubmit={handleSubmit} 
          uploadProgress={uploadProgress}
          currentUpload={currentUpload}
          handleSelectFile={handleSelectFile}
        />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >

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
      </KeyboardAvoidingView> 
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
  );
};

// Componente DatosPersonalesForm
const DatosPersonalesForm = ({ formData, setFormData, errors, onNext }) => {
  
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dateInputValue, setDateInputValue] = useState(
    formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento).toISOString().split('T')[0] : ''
  );
  const [dateError, setDateError] = useState('');
  const [categoriaError, setCategoriaError] = useState('');

  const determinarCategoria = async (fechaNacimiento, sexo) => {
    if (!fechaNacimiento || !sexo) return;

    try {
      const fechaNac = new Date(fechaNacimiento);
      const categoriasRef = collection(db, 'categorias');
      const q = query(categoriasRef, where('sexo', '==', sexo));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('No se encontraron categorías para el sexo especificado');
        setFormData(prev => ({
          ...prev,
          categoria: 'NO ENCONTRADA',
          temporadaId: null,
        }));
        return;
      }

      let categoriaAsignada = 'NO ENCONTRADA';
      let tempTemporadaInfo = null;

      for (const doc of querySnapshot.docs) {
        const categoriaData = doc.data();
        const fechaInicio = new Date(categoriaData.fecha_inicio);
        const fechaFin = new Date(categoriaData.fecha_fin);

        if (fechaNac >= fechaInicio && fechaNac <= fechaFin) {
          categoriaAsignada = categoriaData.nombre_categoria;
          tempTemporadaInfo = {
            nombre: categoriaData.temporada,
            id: categoriaData.temporadaId
          };
          break;
        }
      }

      setFormData(prev => ({
        ...prev,
        categoria: categoriaAsignada,
        temporadaId: tempTemporadaInfo?.id || null
      }));

    } catch (error) {
      console.error('Error al determinar categoría:', error);
      setFormData(prev => ({
        ...prev,
        categoria: 'NO ENCONTRADA',
        temporadaId: null
      }));
    }
  };


useEffect(() => {
  // Limpiar error de categoría cuando se actualice a un valor válido
  if (formData.categoria && formData.categoria !== 'NO ENCONTRADA') {
    setCategoriaError('');
  }
}, [formData.categoria]);

  useEffect(() => {
    if (formData.tipo_inscripcion === 'porrista') {
      setFormData(prev => ({ ...prev, categoria: '' }));
      return;
    }

    if (formData.fecha_nacimiento && formData.sexo) {
      determinarCategoria(formData.fecha_nacimiento, formData.sexo);
    }
  }, [formData.fecha_nacimiento, formData.sexo, formData.tipo_inscripcion]);

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
    
    // Validar si la fecha es hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(validDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() === today.getTime()) {
      setDateError('La fecha de nacimiento no puede ser hoy');
    } else {
      setDateError('');
    }
    
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

  const handleNext = () => {
    // Validar categoría solo si no es porrista
  if (formData.tipo_inscripcion !== 'porrista') {
    if (!formData.categoria || formData.categoria === 'NO ENCONTRADA') {
      setCategoriaError('No se pudo asignar una categoría válida. Verifica la fecha de nacimiento.');
      return;
    }
    // No necesitamos else aquí, el useEffect se encargará de limpiar el error
  }
    
    // Validar fecha
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.fecha_nacimiento);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() === today.getTime()) {
      setDateError('La fecha de nacimiento no puede ser hoy');
      return;
    }
    
    // Si todo está bien, continuar
    setDateError('');
    setCategoriaError('');
    onNext();
  };

  return (
    <ScrollView 
      style={styles.mainContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >  
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

          <Text style={styles.label}>Fecha de Nacimiento:</Text>
          
          {Platform.OS !== 'web' ? (
            <>
              <Button 
                title="Seleccionar fecha"
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
          
          {/* Mostrar error de fecha solo para porristas */}
          {formData.tipo_inscripcion === 'porrista' && dateError && (
            <Text style={styles.errorText}>{dateError}</Text>
          )}

          {/* Contenedor de categoría y errores asociados */}
          {formData.tipo_inscripcion !== 'porrista' && (
            <View style={styles.categoriaContainer}>
              {/* Información de categoría */}
              {formData.categoria && (
                <>
                  <Text style={styles.categoriaText}>
                    Categoría asignada: 
                    <Text style={styles.categoriaValue}>{formData.categoria}</Text>
                  </Text>
                  {formData.categoria === 'NO ENCONTRADA' && (
                    <Text style={styles.categoriaNota}>
                      *El jugador está fuera de los rangos de edad, VERIFICA SU FECHA DE NACIMIENTO
                    </Text>
                  )}
                </>
              )}
              
              {/* Errores agrupados */}
              {dateError && <Text style={styles.errorText}>{dateError}</Text>}
              {categoriaError && <Text style={styles.errorText}>{categoriaError}</Text>}
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Lugar de Nacimiento"
            value={formData.lugar_nacimiento}
            onChangeText={(text) => setFormData({ ...formData, lugar_nacimiento: text })}
          />
          {errors.lugar_nacimiento && <Text style={styles.errorText}>{errors.lugar_nacimiento}</Text>}

          <TextInput
            style={styles.input}
            placeholder="CURP (EN MAYUSCULAS)"
            value={formData.curp}
            onChangeText={(text) => setFormData({ ...formData, curp: text.toUpperCase() })}
            maxLength={18}
          />
          {errors.curp && <Text style={styles.errorText}>{errors.curp}</Text>}

          <TouchableOpacity 
            onPress={() => Linking.openURL('https://www.gob.mx/curp/')} 
            style={styles.linkContainer}
          >
            <Text style={styles.linkText}>¿No sabes tu CURP? Consúltala aquí</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleNext}
            disabled={!!dateError || (formData.tipo_inscripcion !== 'porrista' && !!categoriaError)}
          >
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView> 
    </ScrollView>
  );
};

// Componente DatosContactoForm
const DatosContactoForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <ScrollView 
            style={styles.mainContent}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >

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
    </ScrollView>
  );
};

// Componente DatosEscolaresMedicosForm
const DatosEscolaresMedicosForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    
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
  );
};

// Componente FirmaFotoForm
const FirmaFotoForm = ({ formData, setFormData, errors, onNext, signatureRef }) => {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
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

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event, gestureState) => {
      const { locationX, locationY } = event.nativeEvent;
      setIsDrawing(true);
      setCurrentPath([{ x: locationX, y: locationY }]);
    },
    onPanResponderMove: (event, gestureState) => {
      if (!isDrawing) return;
      const { locationX, locationY } = event.nativeEvent;
      setCurrentPath((prevPath) => [...prevPath, { x: locationX, y: locationY }]);
    },
    onPanResponderRelease: () => {
      setIsDrawing(false);
      setPaths((prevPaths) => [...prevPaths, currentPath]);
      setCurrentPath([]);
      setFormData(prev => ({ ...prev, firma: [...prev.firma, ...currentPath] }));
    },
  });

  const getPathData = (path) => {
    if (path.length === 0) return '';
    return path
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
    setFormData(prev => ({ ...prev, firma: [] }));
  };

 const handleSelectFoto = async () => {
  if (!hasGalleryPermission) {
    Alert.alert('Permisos denegados', 'Necesitas permitir el acceso a la galería para seleccionar una imagen. Cierra la app y ve a ""Configuración> Apps > Club Potros y otorga los permisos');
    return;
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImage = result.assets[0];
      setFormData(prev => ({
        ...prev,
        foto_jugador: {
          uri: selectedImage.uri,
          name: `foto_jugador_${Date.now()}.jpg`,
          type: selectedImage.mimeType || 'image/jpeg'
        }
      }));
    }
  } catch (error) {
    console.error('Error al seleccionar la foto:', error);
    Alert.alert('Error', 'No se pudo seleccionar la imagen');
  }
};

  const handleTakePhoto = async () => {
    if (!hasCameraPermission) {
      Alert.alert('Permisos denegados', 'Necesitas permitir el acceso a la cámara para tomar una foto. Cierra la app y ve a "Configuración> Apps > Club Potros" y otorga los permisos');
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
        setFormData((prevData) => ({
          ...prevData,
          foto_jugador: {
            uri: uri,
            name: `foto_jugador_${Date.now()}.jpg`,
            type: 'image/jpeg'
          }
        }));

      }
    } catch (error) {
      console.error('Error al tomar la foto:', error);
    }
  };

  return (
    <ScrollView 
            style={styles.mainContent}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
      <View style={styles.formContainer}>
        <Text style={styles.title}>Firma y Foto</Text>
        
        <Text style={styles.sectionTitle}>Firma:</Text>
        <View style={styles.signatureContainer} {...panResponder.panHandlers}>
          <Svg style={styles.canvas} ref={signatureRef}>
            {paths.map((path, index) => (
              <Path
                key={index}
                d={getPathData(path)}
                stroke="black"
                strokeWidth={3}
                fill="none"
              />
            ))}
            <Path
              d={getPathData(currentPath)}
              stroke="black"
              strokeWidth={3}
              fill="none"
            />
          </Svg>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={clearCanvas}>
          <Text style={styles.secondaryButtonText}>Limpiar Firma</Text>
        </TouchableOpacity>
        {errors.firma && <Text style={styles.errorText}>{errors.firma}</Text>}
        
        <Text style={styles.sectionTitle}>Foto del Jugador:</Text>
        {formData.foto_jugador && (
          <Image
            source={{ uri: formData.foto_jugador.uri }} // Accede a la propiedad uri del objeto
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
        
        <TouchableOpacity style={styles.button} onPress={onNext}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const DocumentacionForm = ({ formData, setFormData, onSubmit, uploadProgress, currentUpload, handleSelectFile }) => {
  const [acceptedRegulation, setAcceptedRegulation] = useState(false);
  const [acceptedDeclaration, setAcceptedDeclaration] = useState(false);

  const renderFileInfo = (field) => {
    const doc = formData.documentos[field];
    if (!doc || !doc.uri) return null;

    return (
      <View style={styles.fileInfoContainer}>
        <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
          {doc.name || 'Archivo seleccionado'}
        </Text>
        
        {currentUpload === field ? (
          <View style={styles.uploadStatus}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.uploadProgressText}>
              {Math.round(uploadProgress[field] || 0)}%
            </Text>
          </View>
        ) : (
          <Text style={styles.uploadPendingText}>Listo para subir</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.mainContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>Documentación Requerida</Text>
        
        {['ine_tutor', 'curp_jugador', 'acta_nacimiento', 'comprobante_domicilio'].map((field) => (
          <View key={field} style={styles.formGroup}>
            <Text style={styles.label}>
              {field === 'ine_tutor' && 'INE del Tutor'}
              {field === 'curp_jugador' && 'CURP del Jugador'}
              {field === 'acta_nacimiento' && 'Acta de Nacimiento'}
              {field === 'comprobante_domicilio' && 'Comprobante de Domicilio'}
            </Text>
            
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={() => handleSelectFile(field)}
              disabled={!!currentUpload}
            >
              <Text style={styles.buttonText}>
                {formData.documentos[field]?.uri ? 'Reemplazar archivo' : 'Seleccionar archivo'}
              </Text>
            </TouchableOpacity>
            
            {renderFileInfo(field)}
          </View>
        ))}

        {/* Sección de declaración de veracidad */}
        <View style={styles.declarationContainer}>
          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={[styles.checkbox, acceptedDeclaration && styles.checkboxChecked]}
              onPress={() => setAcceptedDeclaration(!acceptedDeclaration)}
            >
              {acceptedDeclaration && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.declarationText}>
              Declaro bajo protesta de decir verdad que la información y documentación proporcionada en esta 
              aplicación y presentada al club toros es verídica, por lo que en caso de existir falsedad en 
              ella deslindo de toda responsabilidad al Club Toros y tengo pleno conocimiento que se aplicarán 
              las sanciones administrativas y penas establecidas en los ordenamientos del reglamento 
              establecido por la liga.
            </Text>
          </View>
        </View>

        {/* Sección de aceptación del reglamento */}
        <View style={styles.regulationContainer}>
          <Text style={styles.regulationTitle}>Reglamento del Equipo</Text>
          
          <TouchableOpacity 
            onPress={() => Linking.openURL('https://clubtoros.com/politicas/reglamentoToros.pdf')} 
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
        </View>

        <TouchableOpacity 
          style={[
            styles.submitButton,
            (!acceptedRegulation || !acceptedDeclaration || currentUpload) && styles.disabledButton
          ]} 
          onPress={onSubmit}
          disabled={!acceptedRegulation || !acceptedDeclaration || !!currentUpload}
        >
          <Text style={styles.submitButtonText}>
            {currentUpload ? 'Subiendo archivos...' : 'Finalizar Registro'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop:35,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
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
    backgroundColor: '#ffbe00',
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
    paddingTop:10,
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
    mainContent: {
    flex: 1,
    zIndex: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
  scrollContent: {
    paddingBottom: 100,
  },
   declarationContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  declarationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
});

export default HomeScreen;
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, TextInput,
  Animated, Platform, PanResponder, Linking, ActivityIndicator,
  Image, Button, SafeAreaView, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { obtenerCategoria } from '../utils/obtenerCategoria';
// Configuración de Firebase
//b51f28
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

  // Función para subir archivos a Firebase Storage
  const uploadFile = async (fileUri, fileName, folder) => {
    try {
      let finalUri = fileUri;
      let blob;
  
      // Manejo especial para Android
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        const cacheFileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.copyAsync({
          from: fileUri,
          to: cacheFileUri
        });
        finalUri = cacheFileUri;
      }
  
      // Convertir a blob
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        blob = await response.blob();
      } else {
        const fileInfo = await FileSystem.getInfoAsync(finalUri);
        if (!fileInfo.exists) throw new Error('El archivo no existe');
        const response = await fetch(finalUri);
        blob = await response.blob();
      }
  
      // Subir a Storage
      const fileExtension = fileName.split('.').pop() || (blob.type.split('/')[1] || 'jpg');
      const newFileName = `${folder}/${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, newFileName);
      const uploadTask = uploadBytesResumable(storageRef, blob);
  
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(prev => ({ ...prev, [folder]: progress }));
          },
          (error) => reject(error),
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error en uploadFile:', error);
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
    if (signatureRef.current) {
      const signatureImage = await signatureRef.current.toDataURL();
      return signatureImage;
    }
    return null;
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

  const handleSubmit = async () => {
    if (validateForm()) {
      setLoading(true);
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        const uid = user?.uid;
        if (!uid) throw new Error('No se pudo obtener el UID del usuario.');
  
        // Subir archivos (devuelven URLs directas)
        const [fotoJugadorURL, firmaURL] = await Promise.all([
          formData.foto_jugador ? uploadFile(formData.foto_jugador, 'foto_jugador.jpg', 'fotos') : null,
          formData.firma.length > 0 ? (async () => {
            const firmaDataURL = await captureSignature();
            return firmaDataURL ? uploadFile(firmaDataURL, 'firma.png', 'firmas') : null;
          })() : null
        ]);
  
        // Subir documentos (solo URLs)
        const documentosSubidos = {};
        const documentosFields = ['ine_tutor', 'curp_jugador', 'acta_nacimiento', 'comprobante_domicilio'];
        
        await Promise.all(documentosFields.map(async (field) => {
          if (formData.documentos[field]?.uri) {
            documentosSubidos[field] = await uploadFile(
              formData.documentos[field].uri,
              formData.documentos[field].name || `${field}.pdf`,
              'documentos'
            );
          }
        }));
  
        // Crear registro principal
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
          foto: fotoJugadorURL, // URL directa
          rol_id:'4ImLOboJDFm76mHNPdeB',
          documentos: {
            // URLs directas
            ine_tutor: documentosSubidos.ine_tutor || null,
            curp_jugador: documentosSubidos.curp_jugador || null,
            acta_nacimiento: documentosSubidos.acta_nacimiento || null,
            comprobante_domicilio: documentosSubidos.comprobante_domicilio || null,
            firma: firmaURL || null
          },
          activo: 'activo',
          numero_mfl: formData.numero_mfl,
          fecha_registro: new Date(),
          uid: uid,
          ...(formData.tipo_inscripcion === 'transferencia' && {
            transferencia: formData.transferencia
          })
        };
  
        // Guardar en colección principal
        const coleccion = formData.tipo_inscripcion === 'porrista' ? 'porristas' : 'jugadores';
        const docRef = await addDoc(collection(db, coleccion), datosRegistro);
  
        // Crear registro de pagos
        const montoTotal = formData.tipo_inscripcion === 'porrista' ? 1500 : 2000;
        const montoPorPago = montoTotal / 4;
        
        const pagosData = {
          fecha_registro: new Date().toISOString().split('T')[0],
          jugadorId: docRef.id,
          monto_total: montoTotal,
          monto_total_pagado: 0,
          monto_total_pendiente: montoTotal,
          nombre: `${formData.nombre} ${formData.apellido_p} ${formData.apellido_m}`,
          pagos: [
            { tipo: "Inscripción", monto: montoPorPago, estatus: "pendiente", fecha_limite: "2025/04/04", fecha_pago: null },
            { tipo: "Coaching", monto: montoPorPago, estatus: "pendiente", fecha_pago: null },
            { tipo: "Túnel", monto: montoPorPago, estatus: "pendiente", fecha_pago: null },
            { tipo: "Botiquín", monto: montoPorPago, estatus: "pendiente", fecha_pago: null }
          ]
        };
  
        const coleccionPagos = formData.tipo_inscripcion === 'porrista' ? 'pagos_porristas' : 'pagos_jugadores';
        await addDoc(collection(db, coleccionPagos), pagosData);
  
        Alert.alert('Éxito', 'Registro completado correctamente');
        navigation.navigate('MainTabs');
      } catch (error) {
        console.error('Error en handleSubmit:', error);
        Alert.alert('Error', error.message || 'Error al completar el registro');
      } finally {
        setLoading(false);
        setCurrentUpload(null);
      }
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

  // Actualizar categoría cuando cambia la fecha o el sexo
  useEffect(() => {
    if (formData.fecha_nacimiento && formData.sexo) {
      const fechaFormateada = formData.fecha_nacimiento.toISOString().split('T')[0];
      const resultado = obtenerCategoria(formData.sexo, fechaFormateada);
      console.log(resultado);
      setFormData(prev => ({ ...prev, categoria: resultado }));
    }
  }, [formData.fecha_nacimiento, formData.sexo]);

  // Función para manejar cambio de fecha en móvil
  const onChangeMobile = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      updateDate(selectedDate);
    }
  };

  // Función para actualizar la fecha de forma segura
  const updateDate = (newDate) => {
    const validDate = new Date(newDate);
    if (isNaN(validDate.getTime())) return;

    setDate(validDate);
    setDateInputValue(validDate.toISOString().split('T')[0]);
    setFormData({ ...formData, fecha_nacimiento: validDate });
  };

  // Manejador para input de fecha en web
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

  // Formateador de fecha seguro
  const formatDate = (dateObj) => {
    if (!dateObj || isNaN(new Date(dateObj).getTime())) return 'Fecha inválida';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateObj).toLocaleDateString('es-MX', options);
  };

  return (
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

      {/* Mostrar categoría asignada */}
      {formData.categoria && (
        <View style={styles.categoriaContainer}>
          <Text style={styles.categoriaText}>
            Categoría asignada: <Text style={styles.categoriaValue}>{formData.categoria}</Text>
          </Text>
          {formData.categoria === 'NC' && (
            <Text style={styles.categoriaNota}>*El jugador está fuera de los rangos de edad (2008-2020)</Text>
          )}
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

      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// Componente DatosContactoForm
const DatosContactoForm = ({ formData, setFormData, errors, onNext }) => {
  return (
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
      
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// Componente DocumentacionForm
const DocumentacionForm = ({ formData, setFormData, onSubmit, uploadProgress, currentUpload, handleSelectFile }) => {
  const [acceptedRegulation, setAcceptedRegulation] = useState(false);

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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
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

        {/* Sección de aceptación del reglamento */}
        <View style={styles.regulationContainer}>
          <Text style={styles.regulationTitle}>Reglamento del Equipo</Text>
          
          <TouchableOpacity 
            onPress={() => Linking.openURL('https://ejemplo.com/reglamento.pdf')} 
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
            (!acceptedRegulation || currentUpload) && styles.disabledButton
          ]} 
          onPress={onSubmit}
          disabled={!acceptedRegulation || !!currentUpload}
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
    backgroundColor: '#b51f28',
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
    borderColor: '#b51f28',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#b51f28',
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
    backgroundColor: '#b51f28',
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
    backgroundColor: '#b51f28',
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
    backgroundColor: '#b51f28',
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
});

export default HomeScreen;
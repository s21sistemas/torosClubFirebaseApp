import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Animated,
  Platform,
  PanResponder,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { app } from '../firebaseConfig'; // Asegúrate de tener configurado Firebase en tu proyecto
import { getAuth } from 'firebase/auth';

const HomeScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0); // Paso actual del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_p: '',
    apellido_m: '',
    sexo: '',
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
    firma: null, // Almacenará la firma como un array de trazos
    club_anterior: '',
    temporadas_jugadas: '',
    motivo_transferencia: '',
    ine: null,
    curp_doc: null,
    acta_nacimiento: null,
  });

  const [errors, setErrors] = useState({}); // Errores de validación
  const fadeAnim = useRef(new Animated.Value(1)).current; // Animación de transición
  const [signaturePaths, setSignaturePaths] = useState([]); // Almacena los trazos de la firma
  const signatureRef = useRef(null); // Referencia al área de dibujo
  const [loading, setLoading] = useState(false); // Estado para manejar la carga

  // Inicializa Firestore y Storage
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Pasos del formulario
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

  // Validación del formulario actual
  const validateForm = () => {
    const newErrors = {};
    switch (steps[currentStep]) {
      case 'FirmaFotoForm':
        if (!formData.firma || formData.firma.length === 0) {
          newErrors.firma = 'Captura tu firma antes de continuar.';
        }
        if (!formData.foto_jugador) {
          newErrors.foto_jugador = 'Sube la foto del jugador antes de continuar.';
        }
        break;
      default:
        break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Retorna true si no hay errores
  };

  // Avanzar al siguiente paso
  const handleNextStep = () => {
    if (validateForm()) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep((prev) => prev + 1); // Avanzar al siguiente paso
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  // Retroceder al paso anterior
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

  // Subir archivos a Firebase Storage
  const uploadFile = async (fileUri, folder) => {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `${folder}/${Date.now()}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error al subir el archivo:', error);
      throw error;
    }
  };

  // Convertir la firma en una imagen
  const captureSignature = async () => {
    if (signatureRef.current) {
      const signatureImage = await signatureRef.current.toDataURL(); // Convertir a base64
      return signatureImage;
    }
    return null;
  };

  // Enviar el formulario a Firestore
  const handleSubmit = async () => {
    if (validateForm()) {
      setLoading(true);
      try {
        // Obtener el UID del usuario autenticado
        const auth = getAuth();
        const user = auth.currentUser;
        const uid = user ? user.uid : null;
  
        if (!uid) {
          throw new Error('No se pudo obtener el UID del usuario.');
        }
  
        // Convertir la firma en una imagen antes de subirla
        const firmaURL = formData.firma ? await captureSignature() : null;
  
        // Subir imágenes y documentos a Firebase Storage
        const fotoJugadorURL = formData.foto_jugador ? await uploadFile(formData.foto_jugador, 'fotos') : null;
        const ineURL = formData.ine ? await uploadFile(formData.ine, 'documentos') : null;
        const curpDocURL = formData.curp_doc ? await uploadFile(formData.curp_doc, 'documentos') : null;
        const actaNacimientoURL = formData.acta_nacimiento ? await uploadFile(formData.acta_nacimiento, 'documentos') : null;
  
        // Guardar datos en Firestore, incluyendo el UID del usuario
        await addDoc(collection(db, 'jugadores'), {
          ...formData,
          foto_jugador: fotoJugadorURL,
          firma: firmaURL,
          ine: ineURL,
          curp_doc: curpDocURL,
          acta_nacimiento: actaNacimientoURL,
          fecha_registro: new Date(),
          uid: uid, // Agregar el UID del usuario
        });
  
        Alert.alert('Éxito', 'Registro completado correctamente');
        navigation.navigate('MainTabs');
      } catch (error) {
        console.error('Error al enviar el formulario:', error);
        Alert.alert('Error', 'No se pudo completar el registro');
      } finally {
        setLoading(false);
      }
    }
  };

  // Renderizar el formulario actual
  const renderForm = () => {
    switch (steps[currentStep]) {
      case 'GeneroForm':
        return <GeneroForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'TipoInscripcionForm':
        return <TipoInscripcionForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosPersonalesForm':
        return <DatosPersonalesForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosContactoForm':
        return <DatosContactoForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DatosEscolaresMedicosForm':
        return <DatosEscolaresMedicosForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'TransferenciaForm':
        return <TransferenciaForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'FirmaFotoForm':
        return <FirmaFotoForm formData={formData} setFormData={setFormData} errors={errors} onNext={handleNextStep} />;
      case 'DocumentacionForm':
        return <DocumentacionForm formData={formData} setFormData={setFormData} errors={errors} onSubmit={handleSubmit} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        {renderForm()}
      </Animated.View>
      {currentStep > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={handlePreviousStep}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>
      )}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      )}
    </View>
  );
};

// 1. Formulario de Género
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

// 2. Formulario de Tipo de Inscripción
const TipoInscripcionForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Tipo de Inscripción</Text>
      <Picker
        selectedValue={formData.tipo_inscripcion}
        onValueChange={(itemValue) => setFormData({ ...formData, tipo_inscripcion: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Selecciona un tipo de inscripción" value="" />
        <Picker.Item label="Novato" value="novato" />
        <Picker.Item label="Reinscripción" value="reinscripcion" />
        <Picker.Item label="Transferencia" value="transferencia" />
        <Picker.Item label="Porrista" value="porrista" />
      </Picker>
      {errors.tipo_inscripcion && <Text style={styles.errorText}>{errors.tipo_inscripcion}</Text>}
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// 3. Formulario de Datos Personales
const DatosPersonalesForm = ({ formData, setFormData, errors, onNext }) => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const onChangeMobile = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setFormData({ ...formData, fecha_nacimiento: selectedDate });
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Datos Personales</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre"
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
      <Text>Selecciona una fecha:</Text>
      {Platform.OS !== 'web' && (
        <>
          <Button title="Seleccionar fecha" onPress={() => setShowPicker(true)} />
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onChangeMobile}
            />
          )}
        </>
      )}
      {Platform.OS === 'web' && (
        <input
          type="date"
          value={date.toISOString().split('T')[0]}
          onChange={(e) => setDate(new Date(e.target.value))}
          style={styles.webInput}
        />
      )}
      <Text style={styles.selectedDate}>
        Fecha seleccionada: {date.toLocaleDateString()}
      </Text>
      {errors.fecha_nacimiento && <Text style={styles.errorText}>{errors.fecha_nacimiento}</Text>}
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
        onChangeText={(text) => setFormData({ ...formData, curp: text })}
      />
      {errors.curp && <Text style={styles.errorText}>{errors.curp}</Text>}
      <TouchableOpacity onPress={() => Linking.openURL('https://www.gob.mx/curp/')} style={styles.linkContainer}>
        <Text style={styles.linkText}>¿No sabes tu CURP? Consúltala aquí</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// 4. Formulario de Datos de Contacto
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

// 5. Formulario de Datos Escolares y Médicos
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

// 6. Formulario de Transferencia
const TransferenciaForm = ({ formData, setFormData, errors, onNext }) => {
  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Datos de Transferencia</Text>
      <TextInput
        style={styles.input}
        placeholder="Club de Origen"
        value={formData.club_anterior}
        onChangeText={(text) => setFormData({ ...formData, club_anterior: text })}
      />
      {errors.club_anterior && <Text style={styles.errorText}>{errors.club_anterior}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Temporadas Jugadas"
        value={formData.temporadas_jugadas}
        onChangeText={(text) => setFormData({ ...formData, temporadas_jugadas: text })}
        keyboardType="numeric"
      />
      {errors.temporadas_jugadas && <Text style={styles.errorText}>{errors.temporadas_jugadas}</Text>}
      <Picker
        selectedValue={formData.motivo_transferencia}
        onValueChange={(itemValue) => setFormData({ ...formData, motivo_transferencia: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="Selecciona un motivo de transferencia" value="" />
        <Picker.Item label="Préstamo" value="prestamo" />
        <Picker.Item label="Cambio de domicilio" value="cambio_domicilio" />
        <Picker.Item label="Descanso" value="descanso" />
        <Picker.Item label="Transferencia definitiva" value="transferencia_definitiva" />
      </Picker>
      {errors.motivo_transferencia && <Text style={styles.errorText}>{errors.motivo_transferencia}</Text>}
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// 7. Formulario de Firma y Foto
const FirmaFotoForm = ({ formData, setFormData, errors, onNext }) => {
  const [paths, setPaths] = useState([]); // Almacena los trazos de la firma
  const [currentPath, setCurrentPath] = useState([]); // Almacena el trazo actual
  const [isDrawing, setIsDrawing] = useState(false); // Indica si el usuario está dibujando
  const [hasCameraPermission, setHasCameraPermission] = useState(null); // Permisos de la cámara
  const [hasGalleryPermission, setHasGalleryPermission] = useState(null); // Permisos de la galería
  const signatureRef = useRef(null); // Referencia al área de dibujo

  // Solicitar permisos para la cámara y la galería
  useEffect(() => {
    (async () => {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');
      setHasGalleryPermission(galleryStatus.status === 'granted');
    })();
  }, []);

  // Configurar el PanResponder para capturar los trazos de la firma
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
    },
  });

  // Convertir los trazos en un formato SVG
  const getPathData = (path) => {
    if (path.length === 0) return '';
    return path
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  };

  // Limpiar el área de dibujo
  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  // Guardar la firma en el estado
  const handleSaveSignature = () => {
    setFormData((prevData) => ({ ...prevData, firma: paths }));
    Alert.alert('Firma guardada', 'La firma se ha guardado correctamente.');
  };

  // Seleccionar una foto de la galería
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
        Alert.alert('Foto seleccionada', 'La foto se ha guardado correctamente.');
      } else {
        Alert.alert('Error', 'No se seleccionó ninguna foto.');
      }
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al seleccionar la foto.');
      console.error('Error al seleccionar la foto:', error);
    }
  };

  // Tomar una foto con la cámara
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
        Alert.alert('Foto tomada', 'La foto se ha guardado correctamente.');
      } else {
        Alert.alert('Error', 'No se tomó ninguna foto.');
      }
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al tomar la foto.');
      console.error('Error al tomar la foto:', error);
    }
  };

  // Manejar el avance al siguiente paso
  const handleNext = () => {
    if (!formData.firma || formData.firma.length === 0) {
      Alert.alert('Error', 'Captura tu firma antes de continuar.');
      return;
    }

    if (!formData.foto_jugador) {
      Alert.alert('Error', 'Sube la foto del jugador antes de continuar.');
      return;
    }

    onNext(); // Avanzar al siguiente paso
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Firma y Foto</Text>
      <View style={styles.signatureContainer} {...panResponder.panHandlers}>
        <Svg style={styles.canvas}>
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
      <TouchableOpacity style={styles.button} onPress={clearCanvas}>
        <Text style={styles.buttonText}>Limpiar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleSaveSignature}>
        <Text style={styles.buttonText}>Guardar Firma</Text>
      </TouchableOpacity>
      {errors.firma && <Text style={styles.errorText}>{errors.firma}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleTakePhoto}>
        <Text style={styles.buttonText}>Tomar Foto del jugador</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={handleSelectFoto}>
        <Text style={styles.buttonText}>Seleccionar Foto de la Galería</Text>
      </TouchableOpacity>
      {formData.foto_jugador && (
        <Image
          source={{ uri: formData.foto_jugador }}
          style={styles.imagePreview}
        />
      )}
      {errors.foto_jugador && <Text style={styles.errorText}>{errors.foto_jugador}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

// 8. Formulario de Documentación
const DocumentacionForm = ({ formData, setFormData, errors, onSubmit }) => {
  const [hasGalleryPermission, setHasGalleryPermission] = useState(null);

  useEffect(() => {
    (async () => {
      const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasGalleryPermission(galleryStatus.status === 'granted');
    })();
  }, []);

  const handleSelectFile = async (field) => {
    if (!hasGalleryPermission) {
      Alert.alert('Permisos denegados', 'Necesitas permitir el acceso a la galería para seleccionar un archivo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setFormData((prevData) => ({ ...prevData, [field]: uri }));
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Documentación</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleSelectFile('ine')}>
        <Text style={styles.buttonText}>Subir INE (PDF)</Text>
      </TouchableOpacity>
      {formData.ine && (
        <Text style={styles.fileName}>Archivo seleccionado: {formData.ine.split('/').pop()}</Text>
      )}
      {errors.ine && <Text style={styles.errorText}>{errors.ine}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => handleSelectFile('curp_doc')}>
        <Text style={styles.buttonText}>Subir CURP (PDF)</Text>
      </TouchableOpacity>
      {formData.curp_doc && (
        <Text style={styles.fileName}>Archivo seleccionado: {formData.curp_doc.split('/').pop()}</Text>
      )}
      {errors.curp_doc && <Text style={styles.errorText}>{errors.curp_doc}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => handleSelectFile('acta_nacimiento')}>
        <Text style={styles.buttonText}>Subir Acta de Nacimiento (PDF)</Text>
      </TouchableOpacity>
      {formData.acta_nacimiento && (
        <Text style={styles.fileName}>Archivo seleccionado: {formData.acta_nacimiento.split('/').pop()}</Text>
      )}
      {errors.acta_nacimiento && <Text style={styles.errorText}>{errors.acta_nacimiento}</Text>}
      <TouchableOpacity style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>Terminar Registro</Text>
      </TouchableOpacity>
    </View>
  );
};

// Estilos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    width: '100%',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    width: '100%',
  },
  button: {
    backgroundColor: '#FBBE08',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  signatureContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
  },
  canvas: {
    flex: 1,
  },
  linkText: {
    color: '#007BFF',
    textDecorationLine: 'underline',
    marginBottom: 15,
  },
  linkContainer: {
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  selectedDate: {
    marginTop: 20,
    fontSize: 16,
    paddingBottom: 20,
  },
  imagePreview: {
    width: 100,
    height: 100,
    marginTop: 10,
    borderRadius: 5,
  },
  fileName: {
    marginTop: 10,
    fontSize: 14,
    color: '#555',
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
});

export default HomeScreen;
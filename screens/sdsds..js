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
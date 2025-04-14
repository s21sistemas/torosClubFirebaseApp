// utils/obtenerCategoria.js

// Función auxiliar para crear el objeto de categoría
function crearCategoria(tipo) {
    return  tipo ;
  }
  
  // Función principal para determinar la categoría
  export function obtenerCategoria(sexo, fechaNacimiento) {
    // Verificar parámetros obligatorios
    if (!sexo || !fechaNacimiento) {
      console.error('Faltan parámetros obligatorios: sexo y fechaNacimiento');
      return null;
    }
  
    // Parsear la fecha de nacimiento (asumiendo formato 'YYYY-MM-DD')
    let fechaNac;
    try {
      const fechaParts = fechaNacimiento.split('-');
      if (fechaParts.length !== 3) {
        throw new Error('Formato de fecha incorrecto');
      }
      
      fechaNac = new Date(
        parseInt(fechaParts[0]), // año
        parseInt(fechaParts[1]) - 1, // mes (0-11)
        parseInt(fechaParts[2]) // día
      );
      
      // Validar que la fecha sea válida
      if (isNaN(fechaNac.getTime())) {
        throw new Error('Fecha inválida');
      }
    } catch (error) {
      console.error('Error al parsear fecha:', error.message);
      return null;
    }
  
    // Obtener fecha actual
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1; // getMonth() devuelve 0-11
    
    // Calcular edad y datos de nacimiento
    const añoNacimiento = fechaNac.getFullYear();
    const mesNacimiento = fechaNac.getMonth() + 1;
    const edad = añoActual - añoNacimiento;
  
    // Lógica para categorías masculinas
    if (sexo.toLowerCase() === 'hombre') {
      // Categorías juveniles
      if (añoNacimiento === (añoActual - 17) || 
          (añoNacimiento === (añoActual - 16) && mesNacimiento <= 6)) {
        return crearCategoria('BT - Juvenil');
      } 
      else if ((añoNacimiento === (añoActual - 16) && mesNacimiento >= 7) || 
               (añoNacimiento === (añoActual - 15))) {
        return crearCategoria('JR - Juvenil');
      }
      else if (añoNacimiento === (añoActual - 14) || 
               (añoNacimiento === (añoActual - 13) && mesNacimiento <= 6)) {
        return crearCategoria('MG - Juvenil');
      }
      else if ((añoNacimiento === (añoActual - 13) && mesNacimiento >= 7) || 
               (añoNacimiento === (añoActual - 12))) {
        return crearCategoria('PW - Juvenil');
      }
  
      // Categorías infantiles
      if (añoNacimiento === (añoActual - 11) || 
          (añoNacimiento === (añoActual - 10) && mesNacimiento <= 6)) {
        return crearCategoria('As - Flag Infantil Varonil');
      }
      else if ((añoNacimiento === (añoActual - 10) && mesNacimiento >= 7) || 
               (añoNacimiento === (añoActual - 9))) {
        return crearCategoria('Hs - Flag Infantil Varonil');
      }
      else if (añoNacimiento === (añoActual - 8) || 
               (añoNacimiento === (añoActual - 7) && mesNacimiento <= 6)) {
        return crearCategoria('js - flag Infantil Varonil');
      }
      else if ((añoNacimiento === (añoActual - 7) && mesNacimiento >= 7) || 
               (añoNacimiento === (añoActual - 6))) {
        return crearCategoria('Ms (NC) - Flag Infantil Varonil');
      }
    }
    // Lógica para categorías femeninas
    else if (sexo.toLowerCase() === 'mujer') {
      if (edad === 17 || edad === 16) {
        return crearCategoria('Master Flag flag Femenil');
      }
      else if (edad === 15 || edad === 14) {
        return crearCategoria('Flag Junior - Flag Femenil');
      }
      else if (edad === 13 || edad === 12) {
        return crearCategoria('Flag Juvenil - Flag Femenil');
      }
      else if (edad === 11 || edad === 10) {
        return crearCategoria('Flag Infantil - Flag Femenil');
      }
      else if (edad === 9 || edad === 8) {
        return crearCategoria('Baby Flag - Flag Femenil');
      }
      else if (edad === 7 || edad === 6) {
        return crearCategoria('Mini Flag (N/C) - Flag Femenil');
      }
    }
  
    // Si no coincide con ninguna categoría
    console.warn(`No se encontró categoría para sexo: ${sexo}, fecha: ${fechaNacimiento}`);
    return null;
  }
  
  // Exportación alternativa como default
  export default obtenerCategoria;
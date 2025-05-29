const generatePDF = async (pago) => {
    let logoBase64 = '';
    try {
      if (Platform.OS !== 'web') {
        try {
          const image = require('../assets/logoToros.jpg');
          logoBase64 = await FileSystem.readAsStringAsync(
            Image.resolveAssetSource(image).uri, 
            { encoding: FileSystem.EncodingType.Base64 }
          );
          logoBase64 = `data:image/jpeg;base64,${logoBase64}`;
        } catch (imageError) {
          console.warn('No se pudo cargar la imagen del logo:', imageError);
        }
      } else {
        logoBase64 = '/logoToros.jpg';
      }
  
      const today = new Date();
      const formattedDate = today.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
  
      const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              padding: 30px;
              color: #333;
              line-height: 1.5;
            }
            .header { 
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #eaeaea;
              padding-bottom: 20px;
            }
            .logo {
              height: 80px;
              width: auto;
              margin-bottom: 15px;
            }
            .title { 
              font-size: 22px; 
              font-weight: bold;
              color: #2c3e50;
              margin: 10px 0 5px 0;
            }
            .subtitle {
              font-size: 16px;
              color: #7f8c8d;
              margin-bottom: 5px;
            }
            .section {
              margin-bottom: 25px;
              background: #f9f9f9;
              padding: 15px 20px;
              border-radius: 5px;
              border-left: 4px solid #3498db;
            }
            .section h3 {
              margin-top: 0;
              color: #2c3e50;
              border-bottom: 1px solid #eee;
              padding-bottom: 8px;
            }
            .info-row {
              display: flex;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              width: 150px;
              color: #34495e;
            }
            .info-value {
              flex: 1;
            }
            .status-paid {
              color: #27ae60;
              font-weight: bold;
            }
            .status-pending {
              color: #e67e22;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
              color: #95a5a6;
              border-top: 1px solid #eee;
              padding-top: 15px;
            }
            .temporada-info {
              background-color: #e3f2fd;
              padding: 10px;
              border-radius: 5px;
              margin-bottom: 15px;
              text-align: center;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo Club Toros" />` : ''}
            <div class="title">COMPROBANTE DE PAGO</div>
            <div class="subtitle">${esPorrista ? 'Porrista' : 'Jugador'}</div>
          </div>
          
          ${temporadaData ? `
          <div class="temporada-info">
            Temporada: ${temporadaData.label || 'No especificada'}
          </div>
          ` : ''}
          
          <div class="section">
            <h3>Información del ${esPorrista ? 'Porrista' : 'Jugador'}</h3>
            <div class="info-row">
              <div class="info-label">Nombre:</div>
              <div class="info-value">${pagoData.nombre_jugador}</div>
            </div>
            ${pagoData.categoria ? `
            <div class="info-row">
              <div class="info-label">Categoría:</div>
              <div class="info-value">${pagoData.categoria}</div>
            </div>` : ''}
          </div>
          
          <div class="section">
            <h3>Detalles del Pago</h3>
            <div class="info-row">
              <div class="info-label">Concepto:</div>
              <div class="info-value">${formatTipoPago(pago.tipo)}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Monto:</div>
              <div class="info-value">$${safeToFixed(pago.monto)}</div>
            </div>
            ${pago.submonto > 0 ? `
            <div class="info-row">
              <div class="info-label">Submonto:</div>
              <div class="info-value">$${safeToFixed(pago.submonto)}</div>
            </div>` : ''}
            ${pago.abonos && pago.abonos.length > 0 ? `
              <div class="section">
                <h3>Detalle de Abonos</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                  <thead>
                    <tr style="background-color: #f5f5f5;">
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Fecha</th>
                      <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Monto</th>
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pago.abonos.map(abono => `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${abono.fecha || 'No especificada'}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${safeToFixed(abono.cantidad)}</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${abono.metodo || 'No especificado'}</td>
                    </tr>
                    `).join('')}
                  </tbody>
                </table>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                  <div style="font-weight: bold;">Total abonado:</div>
                  <div style="font-weight: bold;">$${safeToFixed(pago.total_abonado)}</div>
                </div>
                ${pago.estatus === 'pendiente' ? `
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                  <div style="font-weight: bold; color: #e53935;">Saldo pendiente:</div>
                  <div style="font-weight: bold; color: #e53935;">$${safeToFixed(pago.saldo_pendiente)}</div>
                </div>
                ` : ''}
              </div>
              ` : ''}
            ${pago.fecha_limite ? `
            <div class="info-row">
              <div class="info-label">Fecha límite:</div>
              <div class="info-value">${pago.fecha_limite}</div>
            </div>` : ''}
            ${pago.fecha_pago ? `
            <div class="info-row">
              <div class="info-label">Fecha de pago:</div>
              <div class="info-value">${pago.fecha_pago}</div>
            </div>` : ''}
            <div class="info-row">
              <div class="info-label">Estado:</div>
              <div class="info-value ${pago.estatus === 'pagado' ? 'status-paid' : 'status-pending'}">
                ${pago.estatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
              </div>
            </div>
            ${pago.beca && pago.beca !== "0" ? `
            <div class="info-row">
              <div class="info-label">Beca aplicada:</div>
              <div class="info-value">${pago.beca}%</div>
            </div>` : ''}
            ${pago.descuento && pago.descuento !== "0" ? `
            <div class="info-row">
              <div class="info-label">Descuento aplicado:</div>
              <div class="info-value">${pago.descuento}%</div>
            </div>` : ''}
            ${pago.abono === "SI" ? `
            <div class="info-row">
              <div class="info-label">Abonos:</div>
              <div class="info-value">$${safeToFixed(pago.total_abonado)} de $${safeToFixed(pago.monto)}</div>
            </div>` : ''}
            ${pago.metodo_pago ? `
            <div class="info-row"> 
              <div class="info-label">Método de pago:</div>
              <div class="info-value">${pago.metodo_pago}</div>
            </div>` : ''}
          </div>
          
          <div class="footer">
            Documento generado el ${formattedDate} - Club Toros © ${today.getFullYear()}
          </div>
        </body>
      </html>`;
  
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,
          height: 792,
        });
  
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Compartir comprobante',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF generado', `Archivo guardado en: ${uri}`);
        }
      }
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      Alert.alert('Error', 'No se pudo generar el comprobante');
    }
  };
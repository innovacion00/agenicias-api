import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Reserva } from '../reservas/entities';
import { Agencia } from '../agencias/entities';
import { User } from '../auth/entities';
import { SendEmailCustomService } from '../common/services';

interface ReservaPendiente {
  _id: string;
  hotel: string;
  total: number;
  totalMitad: number;
  pagadoPrimeraMitad: boolean;
  fechaLimitePago: string;
  fechaLimitePago2: string;
  status: number;
  reservation: {
    checkin: string;
    checkout: string;
    firstName: string;
    lastName: string;
    email: string;
    telephone: string;
    adults: string;
    children: string;
    nights: string;
    city: string;
    country: string;
    currency: string;
  };
  agencia: {
    _id: string;
    fullName: string;
    category: number;
    empresa: boolean;
    emailContacto: string;
    telefonoContacto: string;
  };
  user: {
    _id: string;
    fullName: string;
    email: string;
    telefono: string;
  };
  diasRestantes: number;
}

@Injectable()
export class BotReservasPendientesService {
  private readonly logger = new Logger(BotReservasPendientesService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<Reserva>,
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly emailService: SendEmailCustomService,
  ) {}

  /**
   * Ejecuta el bot cada día a las 8:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async ejecutarBotReservasPendientes() {
    this.logger.log(' Iniciando bot de reservas pendientes de pago...');
    
    try {
      const reservasPendientes = await this.obtenerReservasPendientes();
      
      if (reservasPendientes.length === 0) {
        this.logger.log(' No hay reservas pendientes de pago para reportar');
        return;
      }

      this.logger.log(` Se encontraron ${reservasPendientes.length} reservas pendientes de pago`);
      
      // Generar archivo Excel
      const excelBuffer = await this.generarExcelReservasPendientes(reservasPendientes);
      
      // Enviar correo con el Excel adjunto
      await this.enviarCorreoReservasPendientes(excelBuffer, reservasPendientes.length);
      
      this.logger.log(' Bot de reservas pendientes ejecutado exitosamente');
      
    } catch (error) {
      this.logger.error(' Error en el bot de reservas pendientes:', error);
    }
  }

  /**
   * Obtiene las reservas que cumplen con los criterios:
   * - status 0: pagadoPrimeraMitad = false, comparar con fechaLimitePago
   * - status 5: pagadoPrimeraMitad = true, comparar con fechaLimitePago2
   * - Solo incluir reservas próximas a vencer (≤ 2 días)
   */
  private async obtenerReservasPendientes(): Promise<ReservaPendiente[]> {
    const fechaActual = new Date();
    
    // Buscar reservas con status 0 (espera) - NO han pagado primera mitad
    const reservasStatus0 = await this.reservaModel
      .find({
        status: 0,
        pagadoPrimeraMitad: false,
        fechaLimitePago: { $exists: true, $ne: null }
      })
      .populate('agenciaId', 'fullName category empresa emailContacto telefonoContacto')
      .populate('userId', 'fullName email telefono')
      .lean();

    // Buscar reservas con status 5 (mitad) - SÍ han pagado primera mitad
    const reservasStatus5 = await this.reservaModel
      .find({
        status: 5,
        pagadoPrimeraMitad: true,
        fechaLimitePago2: { $exists: true, $ne: null }
      })
      .populate('agenciaId', 'fullName category empresa emailContacto telefonoContacto')
      .populate('userId', 'fullName email telefono')
      .lean();

    const reservasPendientes: ReservaPendiente[] = [];

    // Procesar reservas status 0 (comparar con fechaLimitePago)
    for (const reserva of reservasStatus0) {
      const fechaLimite = new Date(reserva.fechaLimitePago);
      const diasRestantes = differenceInDays(fechaLimite, fechaActual);

      // Solo incluir reservas con 0 a 2 días restantes (evitar días negativos)
      if (diasRestantes >= 0 && diasRestantes <= 2) {
        if (this.validarCamposPopulados(reserva)) {
          const agencia = reserva.agenciaId as any;
          const user = reserva.userId as any;
          
          reservasPendientes.push({
            _id: reserva._id.toString(),
            hotel: reserva.hotel,
            total: reserva.total,
            totalMitad: reserva.totalMitad,
            pagadoPrimeraMitad: reserva.pagadoPrimeraMitad,
            fechaLimitePago: reserva.fechaLimitePago,
            fechaLimitePago2: reserva.fechaLimitePago2,
            status: reserva.status,
            reservation: reserva.reservation,
            agencia: {
              _id: agencia._id.toString(),
              fullName: agencia.fullName,
              category: agencia.category,
              empresa: agencia.empresa,
              emailContacto: agencia.emailContacto,
              telefonoContacto: agencia.telefonoContacto,
            },
            user: {
              _id: user._id.toString(),
              fullName: user.fullName,
              email: user.email,
              telefono: user.telefono,
            },
            diasRestantes,
          });
        }
      }
    }

    // Procesar reservas status 5 (comparar con fechaLimitePago2)
    for (const reserva of reservasStatus5) {
      const fechaLimite = new Date(reserva.fechaLimitePago2);
      const diasRestantes = differenceInDays(fechaLimite, fechaActual);

      // Solo incluir reservas con 0 a 2 días restantes (evitar días negativos)
      if (diasRestantes >= 0 && diasRestantes <= 2) {
        if (this.validarCamposPopulados(reserva)) {
          const agencia = reserva.agenciaId as any;
          const user = reserva.userId as any;
          
          reservasPendientes.push({
            _id: reserva._id.toString(),
            hotel: reserva.hotel,
            total: reserva.total,
            totalMitad: reserva.totalMitad,
            pagadoPrimeraMitad: reserva.pagadoPrimeraMitad,
            fechaLimitePago: reserva.fechaLimitePago,
            fechaLimitePago2: reserva.fechaLimitePago2,
            status: reserva.status,
            reservation: reserva.reservation,
            agencia: {
              _id: agencia._id.toString(),
              fullName: agencia.fullName,
              category: agencia.category,
              empresa: agencia.empresa,
              emailContacto: agencia.emailContacto,
              telefonoContacto: agencia.telefonoContacto,
            },
            user: {
              _id: user._id.toString(),
              fullName: user.fullName,
              email: user.email,
              telefono: user.telefono,
            },
            diasRestantes,
          });
        }
      }
    }

    // Ordenar por días restantes (menor a mayor)
    return reservasPendientes.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }

  /**
   * Valida que los campos populados existan y tengan la estructura correcta
   */
  private validarCamposPopulados(reserva: any): boolean {
    return reserva.agenciaId && 
           typeof reserva.agenciaId === 'object' && 
           'fullName' in reserva.agenciaId &&
           reserva.userId && 
           typeof reserva.userId === 'object' && 
           'fullName' in reserva.userId;
  }

  /**
   * Genera un archivo Excel con las reservas pendientes
   */
  private async generarExcelReservasPendientes(reservas: ReservaPendiente[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reservas Pendientes de Pago');

    // Configurar estilos del encabezado
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    // Configurar estilos de las celdas
    const cellStyle = {
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
      alignment: { vertical: 'middle' },
    };

    // Definir columnas
    worksheet.columns = [
      { header: 'ID Reserva', key: 'id', width: 15 },
      { header: 'Hotel', key: 'hotel', width: 25 },
      { header: 'Agencia', key: 'agencia', width: 30 },
      { header: 'Usuario', key: 'usuario', width: 25 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Total Mitad', key: 'totalMitad', width: 15 },
      { header: 'Pagado Primera Mitad', key: 'pagadoPrimeraMitad', width: 20 },
      { header: 'Fecha Límite Pago', key: 'fechaLimitePago', width: 20 },
      { header: 'Días Restantes', key: 'diasRestantes', width: 15 },
      { header: 'Check-in', key: 'checkin', width: 15 },
      { header: 'Check-out', key: 'checkout', width: 15 },
      { header: 'Huesped', key: 'huesped', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'telefono', width: 20 },
      { header: 'Adultos', key: 'adultos', width: 10 },
      { header: 'Niños', key: 'ninos', width: 10 },
      { header: 'Noches', key: 'noches', width: 10 },
      { header: 'Ciudad', key: 'ciudad', width: 20 },
      { header: 'País', key: 'pais', width: 15 },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Categoría Agencia', key: 'categoriaAgencia', width: 20 },
      { header: 'Tipo Agencia', key: 'tipoAgencia', width: 20 },
      { header: 'Email Agencia', key: 'emailAgencia', width: 30 },
      { header: 'Teléfono Agencia', key: 'telefonoAgencia', width: 20 },
    ];

    // Aplicar estilos al encabezado
    worksheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    // Agregar datos
    reservas.forEach((reserva, index) => {
      const row = worksheet.addRow({
        id: reserva._id,
        hotel: reserva.hotel,
        agencia: reserva.agencia.fullName,
        usuario: reserva.user.fullName,
        estado: this.obtenerEstadoReserva(reserva.status),
        total: reserva.total,
        totalMitad: reserva.totalMitad,
        pagadoPrimeraMitad: reserva.pagadoPrimeraMitad ? 'Sí' : 'No',
        fechaLimitePago: format(new Date(reserva.fechaLimitePago), 'dd/MM/yyyy', { locale: es }),
        diasRestantes: reserva.diasRestantes,
        checkin: format(new Date(reserva.reservation.checkin), 'dd/MM/yyyy', { locale: es }),
        checkout: format(new Date(reserva.reservation.checkout), 'dd/MM/yyyy', { locale: es }),
        huesped: `${reserva.reservation.firstName} ${reserva.reservation.lastName}`,
        email: reserva.reservation.email,
        telefono: reserva.reservation.telephone,
        adultos: reserva.reservation.adults,
        ninos: reserva.reservation.children || '0',
        noches: reserva.reservation.nights,
        ciudad: reserva.reservation.city,
        pais: reserva.reservation.country,
        moneda: reserva.reservation.currency,
        categoriaAgencia: reserva.agencia.category === 1 ? 'Mayorista' : 'Minorista',
        tipoAgencia: reserva.agencia.empresa ? 'Empresa' : 'Persona Natural',
        emailAgencia: reserva.agencia.emailContacto,
        telefonoAgencia: reserva.agencia.telefonoContacto,
      });

      // Aplicar estilos a las celdas
      row.eachCell((cell) => {
        Object.assign(cell, cellStyle);
      });

      // Resaltar filas con días restantes críticos
      if (reserva.diasRestantes <= 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6B8' }, // Amarillo claro
        };
      }
    });

    // Generar buffer del archivo
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Obtiene el texto del estado de la reserva
   */
  private obtenerEstadoReserva(status: number): string {
    switch (status) {
      case 0:
        return 'Espera';
      case 5:
        return 'Mitad Pagada';
      default:
        return 'Desconocido';
    }
  }

  /**
   * Envía el correo con el archivo Excel adjunto
   */
  private async enviarCorreoReservasPendientes(excelBuffer: Buffer, cantidadReservas: number): Promise<void> {
    const fechaActual = format(new Date(), 'dd/MM/yyyy', { locale: es });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Reservas Pendientes de Pago</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #366092;
          }
          .header h1 {
            color: #366092;
            margin: 0;
            font-size: 28px;
          }
          .content {
            color: #333;
            font-size: 16px;
            line-height: 1.6;
            margin: 20px 0;
          }
          .stats {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #366092;
          }
          .stats h3 {
            color: #366092;
            margin-top: 0;
          }
          .stats p {
            margin: 10px 0;
            font-size: 18px;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1> Reporte de Reservas Pendientes de Pago</h1>
            <p>Fecha: ${fechaActual}</p>
          </div>
          
          <div class="content">
            <p>Se ha generado el reporte diario de reservas pendientes de pago para el sistema de Geh Suites.</p>
            
            <div class="stats">
              <h3> Resumen del Reporte</h3>
              <p><strong>Total de Reservas Pendientes:</strong> ${cantidadReservas}</p>
              <p><strong>Fecha de Generación:</strong> ${fechaActual}</p>
              <p><strong>Hora de Generación:</strong> ${format(new Date(), 'HH:mm:ss')}</p>
            </div>
            
            <div class="warning">
              <strong> Importante:</strong> Las reservas incluidas en este reporte tienen 2 días o menos para completar el pago. 
              Se recomienda contactar a las agencias correspondientes para gestionar los pagos pendientes.
            </div>
            
            <p>El archivo Excel adjunto contiene toda la información detallada de las reservas pendientes, incluyendo:</p>
            <ul>
              <li>Información de la reserva (hotel, fechas, totales)</li>
              <li>Datos de la agencia y usuario</li>
              <li>Estado de pagos y fechas límite</li>
              <li>Información de contacto</li>
              <li>Días restantes para el pago</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Este es un reporte automático generado por el sistema de Geh Suites</p>
            <p>Para consultas adicionales, contactar al equipo de soporte</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar correo con el Excel adjunto
    await this.emailService.sendEmail(
      'reservas@gehsuites.com',
      'Reservas Pendientes de Pago - Reporte Diario',
      html,
      [
        {
          filename: `reservas-pendientes-${fechaActual.replace(/\//g, '-')}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    );

    this.logger.log(` Correo enviado exitosamente a reservas@gehsuites.com con ${cantidadReservas} reservas`);
  }

  /**
   * Método manual para ejecutar el bot (útil para testing)
   */
  async ejecutarManualmente(): Promise<void> {
    this.logger.log(' Ejecutando bot manualmente...');
    await this.ejecutarBotReservasPendientes();
  }

  /**
   * Método de diagnóstico para revisar las reservas en la base de datos
   */
  async diagnosticoReservas() {
    this.logger.log(' Ejecutando diagnóstico de reservas...');
    
    const fechaActual = new Date();
    
    // 1. Contar total de reservas
    const totalReservas = await this.reservaModel.countDocuments();
    
    // 2. Contar reservas por status
    const reservasPorStatus = await this.reservaModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // 3. Contar reservas con pagadoPrimeraMitad = true
    const reservasConPrimeraMitad = await this.reservaModel.countDocuments({
      pagadoPrimeraMitad: true
    });
    
    // 4. Contar reservas con pagadoPrimeraMitad = false
    const reservasSinPrimeraMitad = await this.reservaModel.countDocuments({
      pagadoPrimeraMitad: false
    });
    
    // 5. Contar reservas status 0 (espera) - NO han pagado primera mitad
    const reservasStatus0 = await this.reservaModel.countDocuments({
      status: 0,
      pagadoPrimeraMitad: false,
      fechaLimitePago: { $exists: true, $ne: null }
    });
    
    // 6. Contar reservas status 5 (mitad) - SÍ han pagado primera mitad
    const reservasStatus5 = await this.reservaModel.countDocuments({
      status: 5,
      pagadoPrimeraMitad: true,
      fechaLimitePago2: { $exists: true, $ne: null }
    });
    
    // 7. Obtener reservas status 0 de ejemplo
    const reservasStatus0Ejemplo = await this.reservaModel
      .find({
        status: 0,
        pagadoPrimeraMitad: false,
        fechaLimitePago: { $exists: true, $ne: null }
      })
      .limit(3)
      .select('_id status pagadoPrimeraMitad fechaLimitePago agenciaId userId hotel total')
      .lean();
    
    // 8. Obtener reservas status 5 de ejemplo
    const reservasStatus5Ejemplo = await this.reservaModel
      .find({
        status: 5,
        pagadoPrimeraMitad: true,
        fechaLimitePago2: { $exists: true, $ne: null }
      })
      .limit(3)
      .select('_id status pagadoPrimeraMitad fechaLimitePago2 agenciaId userId hotel total')
      .lean();
    
    // 9. Verificar reservas status 0 con fechas límite próximas
    const reservasStatus0ConFechaLimite = await this.reservaModel
      .find({
        status: 0,
        pagadoPrimeraMitad: false,
        fechaLimitePago: { $exists: true, $ne: null }
      })
      .select('_id status pagadoPrimeraMitad fechaLimitePago')
      .lean();
    
    // 10. Verificar reservas status 5 con fechas límite próximas
    const reservasStatus5ConFechaLimite = await this.reservaModel
      .find({
        status: 5,
        pagadoPrimeraMitad: true,
        fechaLimitePago2: { $exists: true, $ne: null }
      })
      .select('_id status pagadoPrimeraMitad fechaLimitePago2')
      .lean();
    
    // 11. Calcular días restantes para reservas status 0
    const reservasStatus0ConDiasRestantes = reservasStatus0ConFechaLimite.map(reserva => {
      const fechaLimite = new Date(reserva.fechaLimitePago);
      const diasRestantes = differenceInDays(fechaLimite, fechaActual);
      return {
        _id: reserva._id,
        status: reserva.status,
        fechaLimitePago: reserva.fechaLimitePago,
        diasRestantes,
        cumpleCriterio: diasRestantes >= 0 && diasRestantes <= 2
      };
    });
    
    // 12. Calcular días restantes para reservas status 5
    const reservasStatus5ConDiasRestantes = reservasStatus5ConFechaLimite.map(reserva => {
      const fechaLimite = new Date(reserva.fechaLimitePago2);
      const diasRestantes = differenceInDays(fechaLimite, fechaActual);
      return {
        _id: reserva._id,
        status: reserva.status,
        fechaLimitePago2: reserva.fechaLimitePago2,
        diasRestantes,
        cumpleCriterio: diasRestantes >= 0 && diasRestantes <= 2
      };
    });
    
    // 13. Contar reservas que cumplen el criterio final
    const reservasStatus0Finales = reservasStatus0ConDiasRestantes.filter(r => r.cumpleCriterio).length;
    const reservasStatus5Finales = reservasStatus5ConDiasRestantes.filter(r => r.cumpleCriterio).length;
    const reservasFinales = reservasStatus0Finales + reservasStatus5Finales;
    
    return {
      fechaActual: fechaActual.toISOString(),
      totalReservas,
      reservasPorStatus,
      reservasConPrimeraMitad,
      reservasSinPrimeraMitad,
      reservasStatus0,
      reservasStatus5,
      reservasStatus0Ejemplo,
      reservasStatus5Ejemplo,
      reservasStatus0ConFechaLimite: reservasStatus0ConFechaLimite.length,
      reservasStatus5ConFechaLimite: reservasStatus5ConFechaLimite.length,
      reservasStatus0ConDiasRestantes,
      reservasStatus5ConDiasRestantes,
      reservasStatus0Finales,
      reservasStatus5Finales,
      reservasFinales,
      criterios: {
        status0: { status: 0, pagadoPrimeraMitad: false, fechaLimite: 'fechaLimitePago', diasRestantes: '0-2' },
        status5: { status: 5, pagadoPrimeraMitad: true, fechaLimite: 'fechaLimitePago2', diasRestantes: '0-2' }
      }
    };
  }
}

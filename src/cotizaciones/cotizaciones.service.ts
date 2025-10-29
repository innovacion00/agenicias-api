import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuid } from 'uuid';
import * as puppeteer from 'puppeteer';

import { Cotizacion, CotizacionStatus } from './entities/cotizacion.entity';
import { CreateCotizacionDto, ResponderCotizacionDto } from './dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AgenciasService } from '../agencias/agencias.service';
import { HttpCustomService } from 'src/common/services';
import { hotelesAutocore, tiposAgencia } from 'src/config';
import { Reserva } from 'src/reservas/entities';
import { User } from 'src/auth/entities';
import { Agencia } from 'src/agencias/entities';
import { calcularFechaLimitePago } from 'src/reservas/utils';

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);

  constructor(
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<Cotizacion>,

    @InjectModel(Reserva.name)
    private reservaModel: Model<Reserva>,

    @InjectModel(User.name)
    private userModel: Model<User>,

    @InjectModel(Agencia.name)
    private agenciaModel: Model<Agencia>,

    private cloudinaryService: CloudinaryService,
    private agenciasService: AgenciasService,
    private httpCustomService: HttpCustomService,
  ) {}

  // #region Crear cotización
  async create(
    createCotizacionDto: CreateCotizacionDto,
    userId: string,
    agenciaId: string,
  ): Promise<Cotizacion> {
    const tokenAcceso = uuid();
    const landingUrl = `${process.env.FRONTEND_URL}/cotizacion/${tokenAcceso}`;

    const fechaLimite =
      createCotizacionDto.fechaLimiteRespuesta ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    const porcentajemarkup = createCotizacionDto.markup;
    const montoconmarkup =
      createCotizacionDto.total * (1 + porcentajemarkup / 100);

    const cotizacion = new this.cotizacionModel({
      ...createCotizacionDto,
      porcentajemarkup,
      montoconmarkup,
      userId,
      agenciaId,
      tokenAcceso,
      landingUrl,
      fechaLimiteRespuesta: fechaLimite,
      status: CotizacionStatus.EN_ESPERA,
    });

    return await cotizacion.save();
  }

  // #region Crear desde disponibilidad
  async createFromDisponibilidad(
    createCotizacionDto: CreateCotizacionDto,
    userId: string,
    agenciaId: string,
  ): Promise<Cotizacion> {
    try {
      const tokenAcceso = uuid();
      const {
        reservaInfo,
        landingHtml,
        landingUrl: providedLandingUrl,
        huespedInfo,
        agenciaInfo,
        ...restDto
      } = createCotizacionDto;

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const landingUrl =
        providedLandingUrl || `${frontendUrl}/cotizacion/${tokenAcceso}`;

      const fechaLimite =
        createCotizacionDto.fechaLimiteRespuesta ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

      this.logger.log('Creando cotización con datos:', {
        userId,
        agenciaId,
        tokenAcceso,
        landingUrl,
        fechaLimiteRespuesta: fechaLimite,
        status: CotizacionStatus.EN_ESPERA,
        hasLandingHtml: !!landingHtml,
        hasHuespedInfo: !!huespedInfo,
        hasAgenciaInfo: !!agenciaInfo,
      });

      const hotel =
        createCotizacionDto.hotelInfo?.name || 'Hotel no especificado';
      const cantidadHabitaciones = parseInt(
        reservaInfo?.reservation?.rooms || '1',
      );

      const porcentajemarkup = createCotizacionDto.markup;
      const montoconmarkup =
        createCotizacionDto.total * (1 + porcentajemarkup / 100);

      const reservationData = {
        ...reservaInfo.reservation,
        roomsData: reservaInfo.reservation.roomsData || [],
      };

      if (huespedInfo) {
        this.logger.log('Información del huésped recibida:', huespedInfo);
      }

      if (agenciaInfo) {
        this.logger.log('Información de la agencia recibida:', agenciaInfo);
      }

      const cotizacion = new this.cotizacionModel({
        ...restDto,
        porcentajemarkup,
        montoconmarkup,
        userId,
        agenciaId,
        tokenAcceso,
        landingUrl,
        landingHtml: landingHtml || '',
        fechaLimiteRespuesta: fechaLimite,
        hotel,
        cantidadHabitaciones,
        reservation: reservationData,
        status: CotizacionStatus.EN_ESPERA,
      });

      const savedCotizacion = await cotizacion.save();
      this.logger.log('Cotización creada exitosamente:', savedCotizacion._id);

      return savedCotizacion;
    } catch (error) {
      this.logger.error('Error al crear cotización:', error);
      throw error;
    }
  }

  // #region Obtener todas por agencia
  async findAllByAgencia(agenciaId: string): Promise<Cotizacion[]> {
    return await this.cotizacionModel
      .find({ agenciaId })
      .populate('userId', 'firstName lastName email telephone')
      .sort({ createdAt: -1 })
      .exec();
  }

  // #region Obtener una por ID
  async findOne(id: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel
      .findById(id)
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  // #region Obtener por token
  async findByToken(tokenAcceso: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel
      .findOne({ tokenAcceso })
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  // #region Obtener por token (público)
  async findByTokenPublic(tokenAcceso: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel
      .findOne({ tokenAcceso })
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  // #region Obtener por ID (público)
  async findByIdPublic(id: string): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel
      .findById(id)
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
      .exec();

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  // #region Responder cotización (Aceptar/Rechazar)
  async responderCotizacion(
    tokenAcceso: string,
    responderCotizacionDto: ResponderCotizacionDto,
  ): Promise<any> {
    const cotizacion = await this.findByToken(tokenAcceso);

    if (cotizacion.status !== CotizacionStatus.EN_ESPERA) {
      throw new BadRequestException('Esta cotización ya ha sido respondida');
    }

    const fechaLimite = new Date(cotizacion.fechaLimiteRespuesta);
    if (new Date() > fechaLimite) {
      throw new BadRequestException('Esta cotización ha expirado');
    }

    // Si se rechaza, simplemente actualizar estado
    if (responderCotizacionDto.status === CotizacionStatus.RECHAZADA) {
      cotizacion.status = CotizacionStatus.RECHAZADA;
      cotizacion.fechaRechazo = new Date();
      cotizacion.motivoRechazo = responderCotizacionDto.motivoRechazo || '';
      await cotizacion.save();

      return {
        message: 'Cotización rechazada exitosamente',
        cotizacion,
      };
    }

    // Si se acepta, verificar disponibilidad y crear reserva
    if (responderCotizacionDto.status === CotizacionStatus.ACEPTADA) {
      cotizacion.status = CotizacionStatus.ACEPTADA;
      cotizacion.fechaAprobacion = new Date();
      await cotizacion.save();

      // Intentar crear la reserva automáticamente
      try {
        const resultadoReserva = await this.convertirAReservaAutomatica(
          cotizacion._id.toString(),
        );

        return {
          message: 'Cotización aceptada y reserva creada exitosamente',
          cotizacion,
          reserva: resultadoReserva,
        };
      } catch (error) {
        // Si hay error al crear la reserva, devolver mensaje específico
        this.logger.error(
          'Error al crear reserva automáticamente:',
          error.message,
        );

        return {
          message: 'Cotización aceptada pero hubo problemas al crear la reserva',
          cotizacion,
          error: error.message,
          detalles:
            'Por favor, contacte con la agencia para procesar la reserva manualmente.',
        };
      }
    }

    return await cotizacion.save();
  }

  // #region Generar PDF (sin botones)
  async generatePdf(cotizacionId: string): Promise<string> {
    const cotizacion = await this.findOne(cotizacionId);

    // Si ya existe el PDF, devolverlo
    if (cotizacion.pdfUrl) {
      return cotizacion.pdfUrl;
    }

    if (!cotizacion.landingHtml) {
      throw new BadRequestException(
        'No hay landing HTML almacenada para generar el PDF',
      );
    }

    // Modificar el HTML para ocultar botones antes de generar el PDF
    const htmlSinBotones = this.removerBotonesDelHTML(cotizacion.landingHtml);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Cargar el HTML modificado
    await page.setContent(htmlSinBotones, { waitUntil: 'networkidle0' });

    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    // Subir a Cloudinary
    const uploadResult = await this.uploadPdfToCloudinary(
      Buffer.from(pdfBuffer),
      `cotizaciones/${cotizacionId}`,
    );

    cotizacion.pdfUrl = uploadResult.secure_url;
    cotizacion.pdfCloudinaryId = uploadResult.public_id;
    await cotizacion.save();

    return cotizacion.pdfUrl;
  }

  // #region Remover botones del HTML
  private removerBotonesDelHTML(html: string): string {
    // Agregar CSS para ocultar los botones de aceptar/rechazar
    const cssParaOcultarBotones = `
      <style>
        /* Ocultar botones de aceptar/rechazar para el PDF */
        button[type="submit"],
        .btn-aceptar,
        .btn-rechazar,
        .cotizacion-actions,
        .botones-cotizacion,
        .action-buttons,
        button:contains("Aceptar"),
        button:contains("Rechazar"),
        input[type="submit"],
        .submit-button,
        form button {
          display: none !important;
          visibility: hidden !important;
        }
      </style>
    `;

    // Insertar el CSS antes del cierre del </head> o al inicio del <body>
    if (html.includes('</head>')) {
      return html.replace('</head>', `${cssParaOcultarBotones}</head>`);
    } else if (html.includes('<body>')) {
      return html.replace('<body>', `<body>${cssParaOcultarBotones}`);
    } else {
      // Si no hay head ni body, agregar al inicio
      return `${cssParaOcultarBotones}${html}`;
    }
  }

  // #region Convertir a reserva automáticamente
  async convertirAReservaAutomatica(cotizacionId: string): Promise<any> {
    const cotizacion = await this.findOne(cotizacionId);

    if (cotizacion.status !== CotizacionStatus.ACEPTADA) {
      throw new BadRequestException(
        'Solo se pueden convertir cotizaciones aceptadas',
      );
    }

    if (cotizacion.reservaId) {
      throw new BadRequestException(
        'Esta cotización ya fue convertida a reserva',
      );
    }

    // Encontrar el hotel ID basado en el nombre del hotel
    const hotelId = this.encontrarHotelIdPorNombre(cotizacion.hotel);
    if (!hotelId) {
      throw new BadRequestException(
        `No se encontró el hotel: ${cotizacion.hotel}`,
      );
    }

    // Paso 1: Verificar disponibilidad actual
    const layout = cotizacion.reservation.roomsData.map((room) => ({
      adults: parseInt(room.adults),
      children_ages: room.children_ages 
        ? room.children_ages.split(',').map((age) => parseInt(age.trim())).filter((age) => !isNaN(age))
        : undefined,
    }));

    // Consultar disponibilidad usando categoría de agencia
    const agenciaInfo = await this.agenciaModel.findById(cotizacion.agenciaId);
    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no encontrada');
    }

    this.logger.log('Consultando disponibilidad:', {
      layout,
      checkin: cotizacion.reservation.checkin,
      nights: cotizacion.reservation.nights,
      city: cotizacion.reservation.city,
      category: agenciaInfo.category,
    });

    const disponibilidadResponse = await this.httpCustomService.getDisponibilidadAutocore(
      layout,
      cotizacion.reservation.checkin,
      parseInt(cotizacion.reservation.nights),
      cotizacion.reservation.city,
      agenciaInfo.category,
      false, // Usar URL de producción
    );

    // Paso 2: Verificar que las habitaciones aún estén disponibles
    const habitacionesNoDisponibles = [];
    const variacionesPrecio = [];

    // Extraer habitaciones disponibles de la respuesta
    const habitacionesDisponibles: any[] = [];
    if (disponibilidadResponse && Array.isArray(disponibilidadResponse)) {
      for (const hotelDisp of disponibilidadResponse) {
        if (hotelDisp.availability) {
          for (const avail of hotelDisp.availability) {
            if (avail.available_rooms) {
              for (const room of avail.available_rooms) {
                if (room.products && room.products.length > 0) {
                  habitacionesDisponibles.push(...room.products);
                }
              }
            }
          }
        }
      }
    }

    for (const roomCotizacion of cotizacion.reservation.roomsData) {
      // Buscar si la habitación y tarifa existen
      const roomDisponible = habitacionesDisponibles.find(
        (product: any) => 
          product.roomId === roomCotizacion.id && 
          product.rateId === roomCotizacion.rateId
      );

      if (!roomDisponible) {
        habitacionesNoDisponibles.push(roomCotizacion.nombreHabitacion);
        continue;
      }

      // Verificar variación de precio (tolerancia del 1%)
      const precioOriginal = roomCotizacion.unitaryPrice;
      const precioActual = roomDisponible.baseRate?.amountAfterTax || 0;
      const diferenciaPorcentaje =
        Math.abs((precioActual - precioOriginal) / precioOriginal) * 100;

      if (diferenciaPorcentaje > 1) {
        variacionesPrecio.push({
          habitacion: roomCotizacion.nombreHabitacion,
          precioOriginal,
          precioActual,
          variacion: `${diferenciaPorcentaje.toFixed(2)}%`,
        });
      }
    }

    // Si hay habitaciones no disponibles, lanzar error
    if (habitacionesNoDisponibles.length > 0) {
      throw new BadRequestException(
        `Las siguientes habitaciones ya no están disponibles: ${habitacionesNoDisponibles.join(', ')}. Por favor, realice una nueva cotización.`,
      );
    }

    // Si hay variaciones significativas de precio, lanzar error
    if (variacionesPrecio.length > 0) {
      const detalles = variacionesPrecio
        .map(
          (v) =>
            `${v.habitacion}: Precio original $${v.precioOriginal}, Precio actual $${v.precioActual} (variación: ${v.variacion})`,
        )
        .join('; ');

      throw new BadRequestException(
        `Hay variaciones significativas en los precios: ${detalles}. Por favor, realice una nueva cotización con los precios actualizados.`,
      );
    }

    // Paso 3: Si todo está bien, crear la reserva
    const user = await this.userModel.findById(cotizacion.userId).populate('agencia', 'fullName autocoreInfo category');

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Transformar agency_type de número a string como lo espera Autocore
    const agencyTypeString = agenciaInfo.category === 1 
      ? tiposAgencia.mayorista 
      : tiposAgencia.minorista;

    // Preparar datos para crear la reserva
    const reservaInfo = {
      agency: {
        is_agency: true,
        agency_type: agencyTypeString, // 'wholesale' o 'retailer'
        external_ref_id: user.agencia['autocoreInfo']?.id?.toString() || '',
      },
      reservation: {
        ...cotizacion.reservation,
        source_of_bussiness: 'Booking Connect - Cotización',
      },
    };

    // Determinar si es reserva de grupo
    const isReservaGrupo = cotizacion.cantidadHabitaciones >= 10;

    // Calcular fechas límite
    const fechasLimite = calcularFechaLimitePago(
      cotizacion.reservation.checkin,
      isReservaGrupo,
    );

    // Log para debugging
    this.logger.log('📤 Datos que se enviarán a Autocore:', {
      hotelId,
      agency: reservaInfo.agency,
      reservation_summary: {
        checkin: cotizacion.reservation.checkin,
        checkout: cotizacion.reservation.checkout,
        nights: cotizacion.reservation.nights,
        rooms: cotizacion.reservation.rooms,
        city: cotizacion.reservation.city,
      }
    });

    // Crear reserva en Autocore
    const reservaAutocoreInfo = await this.httpCustomService.createReservaAutocore(
      hotelId,
      reservaInfo,
    );

    if (reservaAutocoreInfo.no_available_rooms) {
      throw new BadRequestException(
        `Error al crear reserva en Autocore: ${reservaAutocoreInfo.msg}`,
      );
    }

    // Crear reserva en la base de datos
    const retenciones: any = {};
    if (cotizacion.reteFuente) {
      retenciones.reteFuente = cotizacion.reteFuente;
    }
    if (cotizacion.reteIca) {
      retenciones.reteIca = cotizacion.reteIca;
    }
    if (cotizacion.reteIva) {
      retenciones.reteIva = cotizacion.reteIva;
    }

    const reserva = await this.reservaModel.create({
      hotel: cotizacion.hotel,
      agenciaId: cotizacion.agenciaId,
      userId: cotizacion.userId,
      cantidadHabitaciones: cotizacion.cantidadHabitaciones,
      total: cotizacion.total,
      totalMitad: cotizacion.total / 2,
      reservation: cotizacion.reservation,
      reservaChatbotId: reservaAutocoreInfo.chatbot_id,
      titularInfo: cotizacion.titularInfo,
      fechaLimitePago: fechasLimite.fechaLimitePago,
      fechaLimitePago2: fechasLimite.fechaLimitePago2,
      exentoIva: cotizacion.exentoIva || false,
      ...retenciones,
      planAlimentario: cotizacion.planAlimentario,
      adicionCena: cotizacion.adicionCena || false,
      adicionAlmuerzo: cotizacion.adicionAlmuerzo || false,
      infoTransporte: cotizacion.infoTransporte || null,
      infoToures: cotizacion.infoToures || null,
      mascotas: cotizacion.mascotas,
      mascotasNumber: cotizacion.mascotasNumber,
      origenIata: cotizacion.origenIata,
    });

    // Actualizar usuario con la nueva reserva
    user.reservas.push(reserva._id as Types.ObjectId);
    await user.save();

    // Actualizar cotización con el ID de la reserva
    cotizacion.status = CotizacionStatus.CONVERTIDA_RESERVA;
    cotizacion.reservaId = reserva._id as Types.ObjectId;
    await cotizacion.save();

    this.logger.log(
      `Cotización ${cotizacionId} convertida a reserva ${reserva._id}`,
    );

    return {
      message: 'Reserva creada exitosamente desde cotización',
      reservaId: reserva._id,
      reservaChatbotId: reservaAutocoreInfo.chatbot_id,
      cotizacionId: cotizacion._id,
    };
  }

  // #region Convertir a reserva (manual)
  async convertirAReserva(cotizacionId: string): Promise<string> {
    return (await this.convertirAReservaAutomatica(cotizacionId)).message;
  }

  // #region Encontrar hotel ID por nombre
  private encontrarHotelIdPorNombre(nombreHotel: string): string | null {
    const hoteles = Object.entries(hotelesAutocore);
    const hotelEncontrado = hoteles.find(
      ([_, data]) => data.name.toLowerCase() === nombreHotel.toLowerCase(),
    );
    return hotelEncontrado ? hotelEncontrado[0] : null;
  }

  // #region Actualizar
  async update(id: string, updateCotizacionDto: any): Promise<Cotizacion> {
    const cotizacion = await this.cotizacionModel.findByIdAndUpdate(
      id,
      updateCotizacionDto,
      { new: true },
    );

    if (!cotizacion) {
      throw new NotFoundException('Cotización no encontrada');
    }

    return cotizacion;
  }

  // #region Eliminar
  async remove(id: string): Promise<void> {
    const result = await this.cotizacionModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException('Cotización no encontrada');
    }
  }

  // #region Estadísticas
  async getEstadisticas(agenciaId: string): Promise<any> {
    const estadisticas = await this.cotizacionModel.aggregate([
      { $match: { agenciaId: new Types.ObjectId(agenciaId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$total' },
        },
      },
    ]);

    return estadisticas;
  }

  // #region Subir PDF a Cloudinary
  private async uploadPdfToCloudinary(
    pdfBuffer: Buffer,
    folder: string,
  ): Promise<any> {
    const file: any = {
      buffer: pdfBuffer,
      originalname: `cotizacion-${Date.now()}.pdf`,
      mimetype: 'application/pdf',
    };

    return await this.cloudinaryService.uploadImage(file, folder);
  }
}

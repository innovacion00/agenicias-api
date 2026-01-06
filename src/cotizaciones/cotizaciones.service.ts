import {
  BadRequestException,
  forwardRef,
  Inject,
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
import { ReservasService } from 'src/reservas/reservas.service';

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
    
    @Inject(forwardRef(() => ReservasService))
    private reservasService: ReservasService,
  ) {}

  // #region Crear cotización
  async create(
    createCotizacionDto: CreateCotizacionDto,
    userId: string,
    agenciaId: string,
  ): Promise<Cotizacion> {
    const { reservaInfo, ...restDto } = createCotizacionDto;

    this.logger.log('Creando cotización (POST /cotizaciones)', {
      userId,
      agenciaId,
      hasReservaInfo: !!reservaInfo,
      hasReservation: !!reservaInfo?.reservation,
      reservaInfoKeys: reservaInfo ? Object.keys(reservaInfo) : [],
    });

    if (!reservaInfo?.reservation) {
      this.logger.error(
        'Payload inválido: falta reservation dentro de reservaInfo',
      );
      throw new BadRequestException(
        'El payload debe incluir reservaInfo.reservation con la información de la reserva.',
      );
    }

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
      ...restDto,
      porcentajemarkup,
      montoconmarkup,
      userId,
      agenciaId,
      tokenAcceso,
      landingUrl,
      fechaLimiteRespuesta: fechaLimite,
      status: CotizacionStatus.EN_ESPERA,
      reservation: reservaInfo.reservation,
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
  async findAll(): Promise<Cotizacion[]> {
    return await this.cotizacionModel
      .find()
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllByAgencia(agenciaId: string): Promise<Cotizacion[]> {
    return await this.cotizacionModel
      .find({ agenciaId })
      .populate('userId', 'firstName lastName email telephone')
      .populate('agenciaId', 'nombre telefono email')
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
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
    // Construir layout correctamente - OMITIR children_ages si está vacío
    const layout = cotizacion.reservation.roomsData.map((room) => {
      const adultsCount = parseInt(room.adults);
      
      // Procesar children_ages correctamente
      const layoutRoom: any = {
        adults: adultsCount,
      };

      if (room.children_ages && room.children_ages.trim() !== '') {
        const ages = room.children_ages
          .split(',')
          .map((age) => parseInt(age.trim()))
          .filter((age) => !isNaN(age));
        
        // Solo agregar children_ages si hay edades válidas
        if (ages.length > 0) {
          layoutRoom.children_ages = ages;
        }
      }

      return layoutRoom;
    });

    // Consultar disponibilidad usando categoría de agencia
    const agenciaInfo = await this.agenciaModel
      .findById(cotizacion.agenciaId)
      .populate('category');
    
    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Log detallado de la agencia
    this.logger.log('🏢 INFO AGENCIA:', {
      agenciaId: agenciaInfo._id,
      fullName: agenciaInfo['fullName'],
      category: agenciaInfo.category,
      isActive: agenciaInfo['isActive'],
      hasAutocoreInfo: !!agenciaInfo['autocoreInfo'],
      autocoreId: agenciaInfo['autocoreInfo']?.id,
    });

    // Log detallado para debugging
    this.logger.log('🔍 DEBUG - Datos de cotización:', {
      hotel: cotizacion.hotel,
      roomsData: cotizacion.reservation.roomsData.map(r => ({
        adults: r.adults,
        children: r.children,
        children_ages: r.children_ages,
        id: r.id,
        rateId: r.rateId,
      })),
    });

    this.logger.log('📤 Consultando disponibilidad en Autocore:', {
      layout: JSON.stringify(layout),
      layoutLength: layout.length,
      layoutFirstItem: layout[0],
      checkin: cotizacion.reservation.checkin,
      nights: cotizacion.reservation.nights,
      nightsParsed: parseInt(cotizacion.reservation.nights),
      nightsType: typeof parseInt(cotizacion.reservation.nights),
      city: cotizacion.reservation.city,
      cityType: typeof cotizacion.reservation.city,
      category: agenciaInfo.category,
      categoryType: typeof agenciaInfo.category,
      categoryValue: agenciaInfo.category === 1 ? 'mayorista (wholesale)' : 'minorista (retailer)',
    });

    // IMPORTANTE: Asegurar que nights sea un número entero
    const nightsNumber = parseInt(cotizacion.reservation.nights, 10);
    
    if (isNaN(nightsNumber) || nightsNumber <= 0) {
      throw new BadRequestException(`El número de noches es inválido: ${cotizacion.reservation.nights}`);
    }

    this.logger.warn('⚠️ Saltando verificación de disponibilidad - Creando reserva directamente');
    
    // NOTA: La verificación de disponibilidad de Autocore está presentando errores 500
    // Por ahora se salta este paso y se procede directamente a crear la reserva
    // TODO: Reactivar verificación cuando Autocore solucione el problema

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
    // IMPORTANTE: Convertir documento de Mongoose a objeto plano usando JSON parse/stringify
    // Esto elimina toda la metadata interna de Mongoose ($__, $isNew, etc.)
    const reservationData = JSON.parse(JSON.stringify(cotizacion.reservation));

    const reservaInfo = {
      agency: {
        is_agency: true,
        agency_type: agencyTypeString, // 'wholesale' o 'retailer'
        external_ref_id: user.agencia['autocoreInfo']?.id?.toString() || '',
      },
      reservation: {
        ...reservationData,
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

    // Log para debugging - Mostrar TODOS los datos
    this.logger.log('📤 Datos COMPLETOS que se enviarán a Autocore:');
    this.logger.log('hotelId:', hotelId);
    this.logger.log('reservaInfo:', JSON.stringify(reservaInfo, null, 2));

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

    // Asegurar que userId y agenciaId sean ObjectId válidos
    const userIdObjectId = cotizacion.userId instanceof Types.ObjectId 
      ? cotizacion.userId 
      : new Types.ObjectId(cotizacion.userId);
    const agenciaIdObjectId = cotizacion.agenciaId instanceof Types.ObjectId 
      ? cotizacion.agenciaId 
      : new Types.ObjectId(cotizacion.agenciaId);

    const reserva = await this.reservaModel.create({
      hotel: cotizacion.hotel,
      agenciaId: agenciaIdObjectId,
      userId: userIdObjectId,
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

  // #region Método de prueba
  async testDisponibilidadDirecta(agenciaId: string) {
    this.logger.log('🧪 TEST: Llamada a disponibilidad usando ReservasService');

    const agenciaInfo = await this.agenciaModel.findById(agenciaId);
    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Layout exacto como el que funciona en reservas
    const layout = [
      {
        adults: 2,
      }
    ];

    const disponibilidadDto = {
      layout: layout,
      checkingDate: '2025-11-20',
      nights: 2,
      ciudad: 'CARTAGENA',
      category: agenciaInfo.category,
    };

    this.logger.log('🧪 DTO para prueba:', disponibilidadDto);

    try {
      const resultado = await this.reservasService.getDisponibilidad(
        new Types.ObjectId(agenciaId),
        disponibilidadDto as any,
      );

      this.logger.log('✅ TEST EXITOSO - Disponibilidad obtenida');
      return {
        success: true,
        hoteles: resultado?.length || 0,
        preview: resultado?.[0]?.hotel || null,
      };
    } catch (error) {
      this.logger.error('❌ TEST FALLIDO:', error.message);
      throw error;
    }
  }
}

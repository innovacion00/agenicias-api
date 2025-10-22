import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cotizacion, CotizacionStatus } from './entities/cotizacion.entity';
import { CreateCotizacionDto, ResponderCotizacionDto } from './dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { AgenciasService } from 'src/agencias/agencias.service';
import { v4 as uuidv4 } from 'uuid';
import * as puppeteer from 'puppeteer';

@Injectable()
export class CotizacionesService {
  constructor(
    @InjectModel(Cotizacion.name) private cotizacionModel: Model<Cotizacion>,
    private cloudinaryService: CloudinaryService,
    private agenciasService: AgenciasService,
  ) {}

  async create(createCotizacionDto: CreateCotizacionDto, userId: string, agenciaId: string): Promise<Cotizacion> {
    // Generar token de acceso único
    const tokenAcceso = uuidv4();
    
    // Generar URL de landing
    const landingUrl = `${process.env.FRONTEND_URL}/cotizacion/${tokenAcceso}`;

    // Usar la fecha límite del DTO o calcular una por defecto (7 días desde hoy)
    const fechaLimite = createCotizacionDto.fechaLimiteRespuesta || 
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Mapear markup a porcentajemarkup para la base de datos
    const porcentajemarkup = createCotizacionDto.markup;
    
    // Calcular montoconmarkup basado en el porcentaje y el monto total
    const montoconmarkup = createCotizacionDto.total * (1 + porcentajemarkup / 100);

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

  async createFromDisponibilidad(
    createCotizacionDto: CreateCotizacionDto,
    userId: string,
    agenciaId: string,
  ): Promise<Cotizacion> {
    try {
      // Este método es específico para crear cotizaciones desde consultas de disponibilidad
      // Aquí se puede agregar lógica adicional para validar que la disponibilidad sigue siendo válida
      // y procesar la información específica de la consulta de disponibilidad
      
      // Generar token de acceso único
      const tokenAcceso = uuidv4();
      
      // Mapear reservaInfo a reservation para la entidad
      const { reservaInfo, landingHtml, landingUrl: providedLandingUrl, huespedInfo, agenciaInfo, ...restDto } = createCotizacionDto;
      
      // Usar la URL de landing proporcionada o generar una por defecto
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const landingUrl = providedLandingUrl || `${frontendUrl}/cotizacion/${tokenAcceso}`;

      // Usar la fecha límite del DTO o calcular una por defecto
      const fechaLimite = createCotizacionDto.fechaLimiteRespuesta || 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log('Creando cotización con datos:', {
        userId,
        agenciaId,
        tokenAcceso,
        landingUrl,
        fechaLimiteRespuesta: fechaLimite,
        status: CotizacionStatus.EN_ESPERA,
        hasLandingHtml: !!landingHtml,
        hasHuespedInfo: !!huespedInfo,
        hasAgenciaInfo: !!agenciaInfo
      });
      
      // Extraer información del hotel y habitaciones de la reserva
      const hotel = reservaInfo?.reservation?.roomsData?.[0]?.nombreHabitacion || 'Hotel no especificado';
      const cantidadHabitaciones = parseInt(reservaInfo?.reservation?.rooms || '1');
      
      // Mapear markup a porcentajemarkup para la base de datos
      const porcentajemarkup = createCotizacionDto.markup;
      
      // Calcular montoconmarkup basado en el porcentaje y el monto total
      const montoconmarkup = createCotizacionDto.total * (1 + porcentajemarkup / 100);
      
      // Mapear correctamente los datos de la reserva
      const reservationData = {
        ...reservaInfo.reservation,
        roomsData: reservaInfo.reservation.roomsData || []
      };

      // Procesar información adicional de landing si se proporciona
      // Los datos de huespedInfo y agenciaInfo se pueden usar para personalizar la landing
      // pero no se almacenan directamente en la entidad Cotizacion
      if (huespedInfo) {
        console.log('Información del huésped recibida:', huespedInfo);
      }
      if (agenciaInfo) {
        console.log('Información de la agencia recibida:', agenciaInfo);
      }
      
      const cotizacion = new this.cotizacionModel({
        ...restDto,
        porcentajemarkup,
        montoconmarkup,
        userId,
        agenciaId,
        tokenAcceso,
        landingUrl,
        landingHtml: landingHtml || '', // Almacenar HTML de landing
        fechaLimiteRespuesta: fechaLimite,
        hotel,
        cantidadHabitaciones,
        reservation: reservationData, // Mapear datos de reserva correctamente
        status: CotizacionStatus.EN_ESPERA,
      });

      const savedCotizacion = await cotizacion.save();
      console.log('Cotización creada exitosamente:', savedCotizacion._id);
      return savedCotizacion;
    } catch (error) {
      console.error('Error al crear cotización:', error);
      throw error;
    }
  }

  async findAllByAgencia(agenciaId: string): Promise<Cotizacion[]> {
    return await this.cotizacionModel
      .find({ agenciaId })
      .populate('userId', 'firstName lastName email telephone')
      .sort({ createdAt: -1 })
      .exec();
  }

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

  async responderCotizacion(
    tokenAcceso: string,
    responderCotizacionDto: ResponderCotizacionDto,
  ): Promise<Cotizacion> {
    const cotizacion = await this.findByToken(tokenAcceso);

    if (cotizacion.status !== CotizacionStatus.EN_ESPERA) {
      throw new BadRequestException('Esta cotización ya ha sido respondida');
    }

    // Verificar si la cotización no ha expirado
    const fechaLimite = new Date(cotizacion.fechaLimiteRespuesta);
    if (new Date() > fechaLimite) {
      throw new BadRequestException('Esta cotización ha expirado');
    }

    cotizacion.status = responderCotizacionDto.status;
    
    if (responderCotizacionDto.status === CotizacionStatus.ACEPTADA) {
      cotizacion.fechaAprobacion = new Date();
    } else if (responderCotizacionDto.status === CotizacionStatus.RECHAZADA) {
      cotizacion.fechaRechazo = new Date();
      // No establecer motivoRechazo (campo removido del DTO)
    }

    return await cotizacion.save();
  }

  // Métodos de landing eliminados - ahora se manejan en createFromDisponibilidad

  async generatePdf(cotizacionId: string): Promise<string> {
    const cotizacion = await this.findOne(cotizacionId);
    
    if (!cotizacion.pdfUrl) {
      if (!cotizacion.landingHtml) {
        throw new BadRequestException('No hay landing HTML almacenada para generar el PDF');
      }

      // Generar PDF usando Puppeteer con el HTML almacenado
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      
      const page = await browser.newPage();
      
      // Cargar el HTML almacenado directamente
      await page.setContent(cotizacion.landingHtml, { waitUntil: 'networkidle0' });
      
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

      // Subir PDF a Cloudinary
      const uploadResult = await this.uploadPdfToCloudinary(
        Buffer.from(pdfBuffer),
        `cotizaciones/${cotizacionId}`,
      );

      // Actualizar cotización con URL del PDF
      cotizacion.pdfUrl = uploadResult.secure_url;
      cotizacion.pdfCloudinaryId = uploadResult.public_id;
      await cotizacion.save();
    }

    return cotizacion.pdfUrl;
  }

  async convertirAReserva(cotizacionId: string): Promise<string> {
    const cotizacion = await this.findOne(cotizacionId);

    if (cotizacion.status !== CotizacionStatus.ACEPTADA) {
      throw new BadRequestException('Solo se pueden convertir cotizaciones aceptadas');
    }

    // Aquí se implementaría la lógica para crear una reserva
    // basada en la cotización aprobada
    // Por ahora, solo marcamos la cotización como convertida
    cotizacion.status = CotizacionStatus.CONVERTIDA_RESERVA;
    await cotizacion.save();

    return 'Cotización convertida a reserva exitosamente';
  }

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

  async remove(id: string): Promise<void> {
    const result = await this.cotizacionModel.findByIdAndDelete(id);
    
    if (!result) {
      throw new NotFoundException('Cotización no encontrada');
    }
  }

  async getEstadisticas(agenciaId: string): Promise<any> {
    const estadisticas = await this.cotizacionModel.aggregate([
      { $match: { agenciaId: agenciaId } },
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

  private async uploadPdfToCloudinary(
    pdfBuffer: Buffer,
    folder: string,
  ): Promise<any> {
    // Crear un objeto file simulado para usar con uploadImage
    const file = {
      buffer: pdfBuffer,
      originalname: `cotizacion-${Date.now()}.pdf`,
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    return await this.cloudinaryService.uploadImage(file, folder);
  }
}

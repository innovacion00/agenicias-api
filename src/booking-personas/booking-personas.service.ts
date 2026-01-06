import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService } from 'src/common/services';
import { hotelesAutocore, hotelesAutocorePaymenLink } from 'src/config';
import { calcularFechaLimitePago } from 'src/reservas/utils';
import { ValidPaymentStatus } from 'src/reservas/interfaces';

import { DisponibilidadPersonasDto } from './dto/disponibilidad-personas.dto';
import { CreateBookingPersonaDto } from './dto/create-booking-persona.dto';
import { BookingPersona } from './entities/booking-persona.entity';
import { PaymentPending, PaymentStatus } from './entities/payment-pending.entity';

@Injectable()
export class BookingPersonasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(BookingPersonasService.name);

  constructor(
    @InjectModel(BookingPersona.name)
    private readonly bookingPersonaModel: Model<BookingPersona>,
    @InjectModel(PaymentPending.name)
    private readonly paymentPendingModel: Model<PaymentPending>,
    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(BookingPersonasService.name);
  }

  // #region Disponibilidad
  async getDisponibilidad(
    disponibilidadPersonasDto: DisponibilidadPersonasDto,
  ) {
    try {
      this.logger.log('=== SERVICIO DISPONIBILIDAD PERSONAS ===');
      this.logger.log('DTO recibido:', disponibilidadPersonasDto);
      
      const { city, checkin, nights, adults, children_ages, room_type } =
        disponibilidadPersonasDto;

      // Normalizar el nombre de la ciudad (case-insensitive)
      const normalizedCity = this.normalizarCiudad(city);
      
      // Buscar todos los hoteles de la ciudad en hotelesAutocore
      const hotelesDeLaCiudad = this.obtenerHotelesPorCiudad(normalizedCity);
      
      if (hotelesDeLaCiudad.length === 0) {
        throw new BadRequestException(
          `No se encontraron hoteles para la ciudad: ${city}. Ciudades disponibles: Cartagena, Bogota, Santa marta`,
        );
      }

      this.logger.log(` Encontrados ${hotelesDeLaCiudad.length} hoteles en ${normalizedCity}:`, 
        hotelesDeLaCiudad.map(h => ({ id: h.id, name: h.name }))
      );

      // Hacer consultas paralelas a Autocore para cada hotel
      this.logger.log(` Iniciando ${hotelesDeLaCiudad.length} consultas paralelas a Autocore...`);
      
      const consultasDisponibilidad = await Promise.allSettled(
        hotelesDeLaCiudad.map((hotel) =>
          this.httpCustomService.getDisponibilidadPersonas(
            hotel.id,
            checkin,
            nights,
            adults,
            children_ages,
            room_type,
            false, // Usar URL de producción
          ).then((data) => {
            const dataAny = data as any;
            this.logger.log(` Hotel ${hotel.id} (${hotel.name}): Disponibilidad obtenida`, {
              hasData: !!data,
              isArray: Array.isArray(data),
              hasAvailableRooms: dataAny && !!dataAny.available_rooms,
              availableRoomsCount: dataAny && dataAny.available_rooms ? dataAny.available_rooms.length : 0,
            });
            return {
              hotelId: hotel.id,
              hotelName: hotel.name,
              city: hotel.city,
              data,
            };
          }).catch((error) => {
            this.logger.error(` Error al consultar disponibilidad para hotel ${hotel.id} (${hotel.name}):`, {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
            });
            return {
              hotelId: hotel.id,
              hotelName: hotel.name,
              city: hotel.city,
              data: null,
              error: error.message,
            };
          })
        )
      );
      
      this.logger.log(` Resultados de consultas:`, {
        total: consultasDisponibilidad.length,
        fulfilled: consultasDisponibilidad.filter(r => r.status === 'fulfilled').length,
        rejected: consultasDisponibilidad.filter(r => r.status === 'rejected').length,
        withData: consultasDisponibilidad.filter(r => 
          r.status === 'fulfilled' && r.value && r.value.data
        ).length,
      });

      // Procesar y normalizar las respuestas (sin filtro de rateDescription)
      const disponibilidadNormalizada = this.normalizarDisponibilidadPorCiudad(
        consultasDisponibilidad,
        normalizedCity,
      );

      this.logger.log(' Disponibilidad normalizada exitosamente');
      return disponibilidadNormalizada;
    } catch (error) {
      this.logger.error('ERROR en getDisponibilidad (Personas):', error);
      this.errorManager.handle(error);
    }
  }

  // #region Normalizar ciudad
  private normalizarCiudad(city: string): string {
    // Normalizar a formato usado en hotelesAutocore
    const cityLower = city.toLowerCase().trim();
    
    this.logger.log(` Normalizando ciudad: "${city}" -> "${cityLower}"`);
    
    if (cityLower.includes('cartagena')) {
      const normalized = 'Cartagena';
      this.logger.log(` Ciudad normalizada: "${city}" -> "${normalized}"`);
      return normalized;
    }
    if (cityLower.includes('bogota') || cityLower.includes('bogotá')) {
      const normalized = 'Bogota';
      this.logger.log(` Ciudad normalizada: "${city}" -> "${normalized}"`);
      return normalized;
    }
    if (cityLower.includes('santa marta') || cityLower.includes('santamarta') || cityLower === 'santa marta') {
      const normalized = 'Santa marta';
      this.logger.log(` Ciudad normalizada: "${city}" -> "${normalized}"`);
      return normalized;
    }
    
    // Si no coincide, retornar el original capitalizado
    const normalized = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    this.logger.warn(` Ciudad no reconocida, usando formato capitalizado: "${city}" -> "${normalized}"`);
    return normalized;
  }

  // #region Obtener hoteles por ciudad
  private obtenerHotelesPorCiudad(city: string): Array<{ id: string; name: string; city: string }> {
    const hoteles: Array<{ id: string; name: string; city: string }> = [];
    
    this.logger.log(` Buscando hoteles para ciudad: "${city}"`);
    this.logger.log(` Hoteles disponibles en hotelesAutocore:`, 
      Object.entries(hotelesAutocore).map(([id, info]) => ({ id, city: info.city, name: info.name }))
    );
    
    Object.entries(hotelesAutocore).forEach(([hotelId, hotelInfo]) => {
      const cityMatch = hotelInfo.city === city;
      this.logger.log(` Comparando: "${hotelInfo.city}" === "${city}" -> ${cityMatch}`);
      
      if (cityMatch) {
        hoteles.push({
          id: hotelId,
          name: hotelInfo.name,
          city: hotelInfo.city,
        });
        this.logger.log(` Hotel agregado: ${hotelId} - ${hotelInfo.name}`);
      }
    });
    
    this.logger.log(` Total hoteles encontrados para "${city}": ${hoteles.length}`);
    
    return hoteles;
  }

  // #region Normalizar disponibilidad por ciudad
  private normalizarDisponibilidadPorCiudad(
    consultas: PromiseSettledResult<any>[],
    city: string,
  ): any {
    const disponibilidadCombinada: any[] = [];
    let totalCount = 0;
    let hotelesProcesados = 0;
    let hotelesConDisponibilidad = 0;

    consultas.forEach((resultado, index) => {
      if (resultado.status === 'fulfilled') {
        const { hotelId, hotelName, data, error } = resultado.value;
        
        if (error) {
          this.logger.warn(` Hotel ${hotelId} (${hotelName}) tiene error: ${error}`);
          return;
        }

        if (!data) {
          this.logger.warn(` Hotel ${hotelId} (${hotelName}) no retornó datos`);
          return;
        }

        hotelesProcesados++;
        this.logger.log(` Procesando hotel ${hotelId} (${hotelName}):`, {
          hasData: !!data,
          isArray: Array.isArray(data),
          hasAvailableRooms: data && !!data.available_rooms,
          dataKeys: data ? Object.keys(data) : [],
        });
        
        // Usar los datos directamente sin filtrar por rateDescription
        this.logger.log(` Procesando hotel ${hotelId} (${hotelName}):`, {
          hasData: !!data,
          isArray: Array.isArray(data),
          hasAvailableRooms: data && !!data.available_rooms,
          availableRoomsCount: data && data.available_rooms 
            ? data.available_rooms.length 
            : 0,
        });
        
        // Si la respuesta es un objeto con available_rooms en la raíz
        if (data && data.available_rooms && Array.isArray(data.available_rooms)) {
          // Agregar información del hotel a cada habitación
          const roomsConHotel = data.available_rooms.map((room: any) => ({
            ...room,
            hotel_id: hotelId,
            hotel_name: hotelName,
            city: city,
          }));
          
          if (roomsConHotel.length > 0) {
            hotelesConDisponibilidad++;
            disponibilidadCombinada.push(...roomsConHotel);
            // Sumar el total_count si existe
            if (data.total_count) {
              totalCount += data.total_count;
            }
            this.logger.log(` Hotel ${hotelId} (${hotelName}): ${roomsConHotel.length} habitaciones agregadas`);
          } else {
            this.logger.warn(` Hotel ${hotelId} (${hotelName}): No hay habitaciones disponibles`);
          }
        }
        else if (Array.isArray(data)) {
          let roomsAgregadas = 0;
          data.forEach((hotel: any) => {
            if (hotel.availability && hotel.availability.length > 0) {
              hotel.availability.forEach((availability: any) => {
                if (availability.available_rooms) {
                  availability.available_rooms.forEach((room: any) => {
                    disponibilidadCombinada.push({
                      ...room,
                      hotel_id: hotelId,
                      hotel_name: hotelName,
                      city: city,
                    });
                    roomsAgregadas++;
                  });
                }
              });
            }
          });
          if (roomsAgregadas > 0) {
            hotelesConDisponibilidad++;
            this.logger.log(` Hotel ${hotelId} (${hotelName}): ${roomsAgregadas} habitaciones agregadas (estructura antigua)`);
          }
        } else {
          this.logger.warn(` Hotel ${hotelId} (${hotelName}): Estructura de datos desconocida`, {
            type: typeof data,
            isArray: Array.isArray(data),
            keys: data ? Object.keys(data) : [],
          });
        }
      } else if (resultado.status === 'rejected') {
        this.logger.error(` Consulta rechazada en índice ${index}:`, resultado.reason);
      }
    });

    this.logger.log(` Resumen de normalización:`, {
      city,
      hotelesProcesados,
      hotelesConDisponibilidad,
      totalHabitaciones: disponibilidadCombinada.length,
      totalCount,
    });

    // Retornar estructura normalizada
    return {
      city: city,
      total_count: totalCount || disponibilidadCombinada.length,
      adults: consultas.length > 0 && consultas[0].status === 'fulfilled' 
        ? consultas[0].value.data?.adults || 0 
        : 0,
      available_rooms: disponibilidadCombinada,
    };
  }

  // #region Filtrar disponibilidad por rateDescription
  private filtrarDisponibilidadPorRateDescription(data: any): any {
    // Tarifas permitidas (comparación case-insensitive y con espacios flexibles)
    const rateDescriptionsPermitidos = [
      '[Standard - BB]',
      '[No Reembolsable - BB]',
      '[Standard-BB]',
      '[No Reembolsable-BB]',
      'Standard - BB',
      'No Reembolsable - BB',
    ];

    // Función para normalizar y comparar rateDescription
    const normalizarRateDescription = (rateDesc: string): string => {
      if (!rateDesc) return '';
      return rateDesc.trim().replace(/\s+/g, ' ').toLowerCase();
    };

    // Normalizar las tarifas permitidas
    const rateDescriptionsNormalizados = rateDescriptionsPermitidos.map(normalizarRateDescription);

    // Función para verificar si un rateDescription coincide
    const coincideConPermitido = (rateDesc: string): boolean => {
      const normalizado = normalizarRateDescription(rateDesc);
      return rateDescriptionsNormalizados.some(permitido => 
        normalizado.includes(permitido) || permitido.includes(normalizado)
      );
    };

    try {
      // Si la respuesta es un array (estructura antigua de Iavailability[])
      if (Array.isArray(data)) {
        return data.map((hotel: any) => {
          if (hotel.availability) {
            const filteredAvailability = hotel.availability.map((room: any) => {
              if (room.available_rooms) {
                const filteredRooms = room.available_rooms.map((availableRoom: any) => {
                  if (availableRoom.rates) {
                    const filteredRates = availableRoom.rates.filter((rate: any) =>
                      rateDescriptionsPermitidos.includes(rate.rateDescription),
                    );
                    return {
                      ...availableRoom,
                      rates: filteredRates,
                    };
                  }
                  // Si tiene products en lugar de rates
                  if (availableRoom.products) {
                    const filteredProducts = availableRoom.products.filter((product: any) => {
                      const coincide = coincideConPermitido(product.rateDescription || '');
                      if (!coincide && product.rateDescription) {
                        this.logger.debug(` Producto filtrado: "${product.rateDescription}" no coincide con tarifas permitidas`);
                      }
                      return coincide;
                    });
                    return {
                      ...availableRoom,
                      products: filteredProducts,
                    };
                  }
                  return availableRoom;
                }).filter((room: any) => 
                  (room.rates && room.rates.length > 0) || 
                  (room.products && room.products.length > 0)
                );
                
                return {
                  ...room,
                  available_rooms: filteredRooms,
                };
              }
              return room;
            }).filter((room: any) => 
              room.available_rooms && room.available_rooms.length > 0
            );
            
            return {
              ...hotel,
              availability: filteredAvailability,
            };
          }
          return hotel;
        }).filter((hotel: any) => 
          hotel.availability && hotel.availability.length > 0
        );
      }

      // Si la respuesta es un objeto con available_rooms en la raíz (estructura nueva)
      if (data && data.available_rooms && Array.isArray(data.available_rooms)) {
        const filteredRooms = data.available_rooms.map((room: any) => {
          if (room.products && Array.isArray(room.products)) {
            const filteredProducts = room.products.filter((product: any) => {
              const coincide = coincideConPermitido(product.rateDescription || '');
              if (!coincide && product.rateDescription) {
                this.logger.debug(` Producto filtrado: "${product.rateDescription}" no coincide con tarifas permitidas`);
              }
              return coincide;
            });
            
            // Solo retornar el room si tiene productos filtrados
            if (filteredProducts.length > 0) {
              return {
                ...room,
                products: filteredProducts,
              };
            }
            return null; // Excluir rooms sin productos permitidos
          }
          return room;
        }).filter((room: any) => room !== null);

        // Retornar el objeto con las habitaciones filtradas
        return {
          ...data,
          available_rooms: filteredRooms,
        };
      }

      // Si no coincide con ninguna estructura conocida, retornar sin filtrar
      this.logger.warn(' Estructura de respuesta desconocida, retornando sin filtrar:', {
        isArray: Array.isArray(data),
        hasAvailableRooms: data && !!data.available_rooms,
        keys: data ? Object.keys(data) : [],
      });
      return data;
    } catch (error) {
      this.logger.error(' Error al filtrar disponibilidad:', error);
      // En caso de error, retornar los datos originales
      return data;
    }
  }

  // #region Generar link de pago
  async generarLinkPago(
    generatePaymentLinkDto: any,
    hotelId: string,
  ) {
    try {
      const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
      if (!hotelInfo) {
        throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
      }

      const hotelPaymentId = hotelesAutocorePaymenLink[hotelInfo.name as keyof typeof hotelesAutocorePaymenLink];
      if (!hotelPaymentId) {
        throw new BadRequestException(`ID de pago no configurado para el hotel ${hotelInfo.name}`);
      }

      // Generar external_ref_id único antes de crear el link
      const externalRefId = `personas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const linkPago = await this.httpCustomService.createLinkPagoPersonasAutocore(
        hotelPaymentId,
        generatePaymentLinkDto.guest_name,
        generatePaymentLinkDto.email,
        generatePaymentLinkDto.phone,
        generatePaymentLinkDto.amount,
        generatePaymentLinkDto.booking_dates,
        generatePaymentLinkDto.description,
        generatePaymentLinkDto.currency || 'COP',
        externalRefId,
      );

      if (!linkPago) {
        throw new InternalServerErrorException('Error al generar link de pago');
      }

      // Guardar el pago pendiente en la base de datos con información de la reserva
      await this.paymentPendingModel.create({
        payment_code: linkPago.code,
        external_ref_id: externalRefId,
        status: PaymentStatus.PENDING,
        amount: generatePaymentLinkDto.amount,
        currency: generatePaymentLinkDto.currency || 'COP',
        hotel_id: hotelId,
        reservation_data: generatePaymentLinkDto.reservation_data || null,
        reserva_creada: false,
      });

      this.logger.log(` Link de pago generado exitosamente: ${linkPago.code}`);
      return {
        payment_url: linkPago.url,
        payment_code: linkPago.code,
        message: generatePaymentLinkDto.reservation_data 
          ? 'Link de pago generado exitosamente. La reserva se creará automáticamente después de que el pago sea completado.'
          : 'Link de pago generado exitosamente. Realiza el pago y luego crea la reserva con el código de pago.',
      };
    } catch (error) {
      this.logger.error('ERROR en generarLinkPago (Personas):', error);
      this.errorManager.handle(error);
    }
  }

  // #region Crear reserva
  async createReserva(
    createBookingPersonaDto: CreateBookingPersonaDto,
    hotelId: string,
    paymentCode?: string,
  ) {
    const cantidadHabitacion =
      createBookingPersonaDto.reservation.roomsData.length;
    
    try {
      // PASO 1: Verificar que el pago fue exitoso
      if (!paymentCode) {
        throw new BadRequestException(
          'El código de pago es requerido. Primero genera un link de pago y completa el pago.',
        );
      }

      this.logger.log(' Verificando pago antes de crear reserva:', { paymentCode });
      
      // Buscar el pago pendiente en la base de datos
      const pagoPendiente = await this.paymentPendingModel.findOne({
        payment_code: paymentCode,
      });

      if (!pagoPendiente) {
        throw new BadRequestException(
          'Código de pago no encontrado. Asegúrate de haber generado el link de pago primero.',
        );
      }

      // Si la reserva ya fue creada automáticamente, retornar la información
      if (pagoPendiente.reserva_creada && pagoPendiente.reserva_id) {
        const reservaExistente = await this.bookingPersonaModel.findById(pagoPendiente.reserva_id);
        if (reservaExistente) {
          this.logger.log(`ℹ️ Reserva ya fue creada automáticamente: ${pagoPendiente.reserva_id}`);
          return {
            reservaId: reservaExistente._id,
            chatbotId: reservaExistente.reservaChatbotId,
            message: 'La reserva ya fue creada automáticamente después del pago.',
            yaExiste: true,
          };
        }
      }

      if (pagoPendiente.status !== PaymentStatus.PAID) {
        throw new BadRequestException(
          `El pago no ha sido completado. Estado actual: ${pagoPendiente.status}. Por favor, completa el pago antes de crear la reserva.`,
        );
      }

      this.logger.log('✅ Pago verificado exitosamente');

      let planAlimentario = '';

      // Determinar si es reserva de grupo (10 o más habitaciones)
      const isReservaGrupo = cantidadHabitacion >= 10;
      
      // Calcular fechas límite usando la nueva lógica
      const fechasLimite = calcularFechaLimitePago(
        createBookingPersonaDto.reservation.checkin,
        isReservaGrupo,
      );
      
      const { fechaLimitePago, fechaLimitePago2 } = fechasLimite;

      const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
      if (!hotelInfo) {
        throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
      }

      // Establecer source_of_business
      createBookingPersonaDto.reservation.source_of_bussiness = 'Booking Personas';

      // PASO 2: Crear reserva en Autocore
      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaPersonasAutocore(
          hotelId,
          createBookingPersonaDto.reservation,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException('Error al crear reserva en Autocore');
      }

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException(reservaAutocoreInfo.msg);
      }

      if (createBookingPersonaDto.planAlimentario) {
        planAlimentario = createBookingPersonaDto.planAlimentario;
      }

      // PASO 3: Crear reserva en la base de datos (marcada como pagada)
      const reserva = await this.bookingPersonaModel.create({
        hotel: hotelInfo.name,
        cantidadHabitaciones: cantidadHabitacion,
        total: createBookingPersonaDto.total,
        reservation: createBookingPersonaDto.reservation,
        reservaChatbotId: reservaAutocoreInfo.chatbot_id,
        titularInfo: createBookingPersonaDto.titularInfo,
        fechaLimitePago,
        fechaLimitePago2,
        exentoIva: createBookingPersonaDto.exentoIva || false,
        planAlimentario,
        adicionCena: createBookingPersonaDto.adicionCena || false,
        adicionAlmuerzo: createBookingPersonaDto.adicionAlmuerzo || false,
        mascotas: createBookingPersonaDto.mascotas || false,
        mascotasNumber: createBookingPersonaDto.mascotasNumber || 0,
        origenIata: createBookingPersonaDto.origenIata || '',
        status: ValidPaymentStatus.total, // Pago Aprobado (ya está pagado)
        pagadoPrimeraMitad: true, // Pago completo
        paymenIds: [pagoPendiente.transaction_id || paymentCode], // Guardar código de pago
      });

      // Marcar el pago como usado (opcional: eliminar o marcar como procesado)
      await this.paymentPendingModel.deleteOne({ payment_code: paymentCode });

      this.logger.log(` Reserva de persona creada exitosamente: ${reserva._id}`);
      return {
        reservaId: reserva._id,
        chatbotId: reservaAutocoreInfo.chatbot_id,
        message: 'Reserva creada exitosamente con pago completo',
      };
    } catch (error) {
      this.logger.error('ERROR en createReserva (Personas):', error);
      this.errorManager.handle(error);
    }
  }

  // #region Cambiar estado de pago (Webhook)
  async cambiarEstadoPagoAutocore(payload: {
    external_ref_id: string;
    transaction_id?: string;
    payment_status: string;
    details: {
      id: string;
      pay_platform?: string;
    };
  }) {
    try {
      this.logger.log(' Webhook recibido para cambio de estado de pago:', payload);

      // Buscar el pago pendiente por external_ref_id
      const pagoPendiente = await this.paymentPendingModel.findOne({
        external_ref_id: payload.external_ref_id,
      });

      if (!pagoPendiente) {
        this.logger.warn(` Pago pendiente no encontrado para external_ref_id: ${payload.external_ref_id}`);
        return { success: false, message: 'Pago pendiente no encontrado' };
      }

      const status = payload.payment_status.toLowerCase();

      // Actualizar el estado del pago según el estado recibido
      switch (status) {
        case 'aplicado':
          pagoPendiente.status = PaymentStatus.PAID;
          pagoPendiente.transaction_id = payload.transaction_id;
          pagoPendiente.paid_at = new Date();
          await pagoPendiente.save();
          this.logger.log(`✅ Pago marcado como pagado: ${pagoPendiente.payment_code}`);
          
          // Crear reserva automáticamente si hay datos de reserva y no se ha creado ya
          if (pagoPendiente.reservation_data && !pagoPendiente.reserva_creada && pagoPendiente.hotel_id) {
            try {
              this.logger.log(`🔄 Creando reserva automáticamente para pago ${pagoPendiente.payment_code}`);
              await this.crearReservaAutomatica(pagoPendiente);
            } catch (error) {
              this.logger.error(`❌ Error al crear reserva automáticamente:`, error);
              // No lanzamos el error para no afectar el webhook
              // La reserva se puede crear manualmente después
            }
          } else {
            if (!pagoPendiente.reservation_data) {
              this.logger.warn(`⚠️ No hay datos de reserva para crear automáticamente: ${pagoPendiente.payment_code}`);
            }
            if (pagoPendiente.reserva_creada) {
              this.logger.log(`ℹ️ Reserva ya fue creada anteriormente: ${pagoPendiente.payment_code}`);
            }
          }
          break;

        case 'rechazado':
        case 'cancelado':
        case 'tarjeta no válida':
          pagoPendiente.status = PaymentStatus.REJECTED;
          await pagoPendiente.save();
          this.logger.log(` Pago marcado como rechazado: ${pagoPendiente.payment_code}`);
          break;

        case 'en proceso':
          // Mantener como pendiente
          this.logger.log(` Pago en proceso: ${pagoPendiente.payment_code}`);
          break;

        default:
          this.logger.warn(` Estado de pago desconocido: ${status}`);
      }

      return { success: true, status: pagoPendiente.status };
    } catch (error) {
      this.logger.error('ERROR en cambiarEstadoPagoAutocore (Personas):', error);
      return { success: false, error: error.message };
    }
  }

  // #region Crear reserva automáticamente desde webhook
  private async crearReservaAutomatica(pagoPendiente: PaymentPending) {
    try {
      // Verificar que no se haya creado ya
      if (pagoPendiente.reserva_creada && pagoPendiente.reserva_id) {
        this.logger.log(`ℹ️ Reserva ya existe: ${pagoPendiente.reserva_id}`);
        return { reservaId: pagoPendiente.reserva_id, yaExiste: true };
      }

      if (!pagoPendiente.reservation_data || !pagoPendiente.hotel_id) {
        throw new BadRequestException('Datos de reserva o hotel_id faltantes');
      }

      const createBookingPersonaDto = pagoPendiente.reservation_data as CreateBookingPersonaDto;
      const hotelId = pagoPendiente.hotel_id;
      const cantidadHabitacion = createBookingPersonaDto.reservation.roomsData.length;

      let planAlimentario = '';

      // Determinar si es reserva de grupo (10 o más habitaciones)
      const isReservaGrupo = cantidadHabitacion >= 10;
      
      // Calcular fechas límite usando la nueva lógica
      const fechasLimite = calcularFechaLimitePago(
        createBookingPersonaDto.reservation.checkin,
        isReservaGrupo,
      );
      
      const { fechaLimitePago, fechaLimitePago2 } = fechasLimite;

      const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
      if (!hotelInfo) {
        throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
      }

      // Establecer source_of_business
      createBookingPersonaDto.reservation.source_of_bussiness = 'Booking Personas';

      // Crear reserva en Autocore
      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaPersonasAutocore(
          hotelId,
          createBookingPersonaDto.reservation,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException('Error al crear reserva en Autocore');
      }

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException(reservaAutocoreInfo.msg);
      }

      if (createBookingPersonaDto.planAlimentario) {
        planAlimentario = createBookingPersonaDto.planAlimentario;
      }

      // Crear reserva en la base de datos (marcada como pagada)
      const reserva = await this.bookingPersonaModel.create({
        hotel: hotelInfo.name,
        cantidadHabitaciones: cantidadHabitacion,
        total: createBookingPersonaDto.total,
        reservation: createBookingPersonaDto.reservation,
        reservaChatbotId: reservaAutocoreInfo.chatbot_id,
        titularInfo: createBookingPersonaDto.titularInfo,
        fechaLimitePago,
        fechaLimitePago2,
        exentoIva: createBookingPersonaDto.exentoIva || false,
        planAlimentario,
        adicionCena: createBookingPersonaDto.adicionCena || false,
        adicionAlmuerzo: createBookingPersonaDto.adicionAlmuerzo || false,
        mascotas: createBookingPersonaDto.mascotas || false,
        mascotasNumber: createBookingPersonaDto.mascotasNumber || 0,
        origenIata: createBookingPersonaDto.origenIata || '',
        status: ValidPaymentStatus.total, // Pago Aprobado (ya está pagado)
        pagadoPrimeraMitad: true, // Pago completo
        paymenIds: [pagoPendiente.transaction_id || pagoPendiente.payment_code], // Guardar código de pago
      });

      // Actualizar PaymentPending con el ID de la reserva creada
      pagoPendiente.reserva_id = reserva._id.toString();
      pagoPendiente.reserva_creada = true;
      // Nota: No podemos actualizar el reservation_id en el link de pago de Autocore
      // porque no hay endpoint para actualizar links existentes, pero esto está bien
      // porque según la documentación de Autocore, reservation_id es opcional
      // y solo se usa como referencia si está disponible al crear el link
      await pagoPendiente.save();

      this.logger.log(`✅ Reserva creada automáticamente: ${reserva._id} para pago ${pagoPendiente.payment_code}`);
      
      return {
        reservaId: reserva._id,
        chatbotId: reservaAutocoreInfo.chatbot_id,
        message: 'Reserva creada automáticamente con pago completo',
      };
    } catch (error) {
      this.logger.error('ERROR en crearReservaAutomatica:', error);
      throw error;
    }
  }
}



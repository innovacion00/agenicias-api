import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { format } from '@formkit/tempo';

import { AutocoreClient } from 'src/autocore/autocore.client';
import { HttpCustomService } from 'src/common/services';
import { Agencia } from 'src/agencias/entities';
import { Reserva } from '../entities';
import { GenerateLinkDto, PagoReservaBilleteraDto } from '../dto';
import { ValidPaymentStatus, LinksHistory } from '../interfaces';
import { debeBloquearCancelacionPorPrimeraMitadPagada } from '../utils';
import { LinksPagoService } from './links-pago.service';
import { ReservasReactivacionService } from './reservas-reactivacion.service';
import { ReservasEmailsService } from './reservas-emails.service';

@Injectable()
export class ReservasPagosService {
  private readonly logger = new Logger(ReservasPagosService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly autocoreClient: AutocoreClient,
    private readonly httpCustomService: HttpCustomService,
    private readonly linksPagoService: LinksPagoService,
    private readonly reactivacionService: ReservasReactivacionService,
    private readonly emailsService: ReservasEmailsService,
  ) {}

  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    const agenciaInfo = await this.agenciaModel.findById(agencia).exec();
    const reservaInfo = await this.reservasModel.findById(
      generateLinkDto.reservaId,
    );

    if (!reservaInfo || reservaInfo.status === 4 || reservaInfo.status === 3) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (!agenciaInfo) {
      throw new NotFoundException('Agencia no encontrada');
    }

    const pagoTotal = generateLinkDto.pagoTotal ?? false;
    const linkInfo = await this.linksPagoService.buildLinkPagoForReserva(
      reservaInfo,
      agenciaInfo,
      pagoTotal,
    );

    if (pagoTotal) {
      await reservaInfo.updateOne({
        $set: { linkInfo, pagadoPrimeraMitad: pagoTotal },
      });
    } else {
      await reservaInfo.updateOne({
        $set: { linkInfo },
      });
    }

    reservaInfo.status = 1;
    await reservaInfo.save();

    return { linkInfo };
  }

  async realizarPagoBilletera(
    pagoReservaBilleteraDto: PagoReservaBilleteraDto,
  ) {
    const data = await this.autocoreClient.pagoBalanceAutocore(
      pagoReservaBilleteraDto.code,
    );
    return data;
  }

  async pagarAutocoreBalanceReserva(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    const linkDoc = await this.generarLinkPago(generateLinkDto, agencia);

    const pagoBalanceInfo = await this.realizarPagoBilletera({
      code: linkDoc.linkInfo.idLinkPago,
    });

    return pagoBalanceInfo;
  }

  async cambiarEstadoPagoAutocore(payload: {
    external_ref_id: string;
    transaction_id?: string;
    payment_status: string;
    details: {
      id: string;
      pay_platform?: string;
    };
  }) {
    if (!payload.external_ref_id) {
      this.logger.error('external_ref_id no proporcionado en payload');
      return true;
    }

    const valores = payload.external_ref_id.split(' ') as string[];
    const problemas = [
      '67ab755cedb19b9bad39f22d',
      '67ab7863edb19b9bad3a4471',
      '67cefa09a0c53ce8c5e1fb9b',
      '67bf4b1a7b358f891dce8926',
      '67c084a87b358f891dd07448',
      '67c761d2be7b7404574c2513',
    ];

    const firstValue = valores[0]?.trim();
    if (!firstValue) {
      this.logger.error(
        `${format(new Date(), '[MM/DD/YY - h:mm:ss a]', 'es')} - Error ${JSON.stringify(payload)}`,
      );
      return true;
    }

    if (problemas.includes(firstValue)) {
      return true;
    }

    const autocoreId = payload.transaction_id?.trim();
    this.logger.log(payload);

    const id = firstValue;

    let pagoValidator: string | null = null;
    if (valores[1]) {
      pagoValidator = valores[1].trim();
    }

    const reserva = await this.reservasModel.findById(id);

    if (!reserva) {
      throw new NotFoundException(`Reserva con id: ${id}`);
    }

    if (!reserva.paymenIds) {
      reserva.paymenIds = [];
    }

    if (
      reserva.status === ValidPaymentStatus.total ||
      reserva.status === ValidPaymentStatus.cancelado
    ) {
      return true;
    }

    const status = String(payload.payment_status || '')
      .trim()
      .toLowerCase();
    if (!status) {
      return true;
    }
    const paymentEventKey = autocoreId ? `${autocoreId}:${status}` : null;
    if (paymentEventKey && reserva.paymenIds.includes(paymentEventKey)) {
      return true;
    } else if (paymentEventKey) {
      reserva.paymenIds.push(paymentEventKey);
    }
    const linkDetails: LinksHistory = {
      id: payload.details.id,
      typeOfPayment: payload.details.pay_platform
        ? payload.details.pay_platform
        : 'No identificado',
      state: undefined,
      fecha: new Date(),
    };
    switch (status) {
      case 'en proceso':
        reserva.status = ValidPaymentStatus.espera;
        await reserva.save();
        return true;

      case 'rechazado':
      case 'cancelado':
      case 'tarjeta no válida':
        linkDetails.state = ValidPaymentStatus.rejected;
        reserva.linksHistory.push(linkDetails);
        if (pagoValidator) {
          reserva.pagadoPrimeraMitad = false;

          reserva.status = ValidPaymentStatus.rejected;
          await reserva.save();
          if (reserva.esReactivacion) {
            await this.reactivacionService.handleReactivacionPagoFallido(
              reserva,
            );
          }
          return true;
        }

        reserva.status = ValidPaymentStatus.rejected;
        await reserva.save();
        if (reserva.esReactivacion) {
          await this.reactivacionService.handleReactivacionPagoFallido(reserva);
        }
        return true;

      case 'aplicado':
        if (!reserva.pagadoPrimeraMitad) {
          linkDetails.state = ValidPaymentStatus.mitad;
          reserva.linksHistory.push(linkDetails);
          reserva.status = ValidPaymentStatus.mitad;
          reserva.pagadoPrimeraMitad = true;
          await reserva.save();
          return true;
        }
        linkDetails.state = pagoValidator
          ? ValidPaymentStatus.total
          : ValidPaymentStatus.mitad;

        reserva.linksHistory.push(linkDetails);
        reserva.status = ValidPaymentStatus.total;
        await reserva.save();
        if (
          reserva.esReactivacion &&
          reserva.status === ValidPaymentStatus.total
        ) {
          await this.reactivacionService.handleReactivacionPagoExitoso(reserva);
        }
        return true;

      default:
        return true;
    }
  }

  async actualizarStatusReservaManual(
    reservaId: Types.ObjectId | string,
    status: ValidPaymentStatus,
    saltarValidacionCheckin = false,
    forzarCancelacionConPagoMitad = false,
  ) {
    try {
      const _id =
        reservaId instanceof Types.ObjectId
          ? reservaId
          : new Types.ObjectId(String(reservaId));

      const reserva = await this.reservasModel.findById(_id).exec();
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!saltarValidacionCheckin) {
        const checkinRaw = reserva.reservation?.checkin;
        if (!checkinRaw || typeof checkinRaw !== 'string') {
          throw new BadRequestException(
            'La reserva no tiene check-in válido para validar el cambio de estado',
          );
        }

        const match = checkinRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          throw new BadRequestException(
            `checkin inválido (se esperaba YYYY-MM-DD): ${checkinRaw}`,
          );
        }
        const checkinDate = new Date(
          `${match[1]}-${match[2]}-${match[3]}T00:00:00`,
        );
        if (Number.isNaN(checkinDate.getTime())) {
          throw new BadRequestException(
            `checkin inválido (no se pudo parsear): ${checkinRaw}`,
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today >= checkinDate) {
          throw new ForbiddenException(
            'No se puede modificar el estado: la reserva ya llegó a la fecha de check-in. Usa ?saltarValidacionCheckin=true si debes corregir datos como superAdmin.',
          );
        }
      }

      const statusNorm = Number(status);
      if (
        !Number.isInteger(statusNorm) ||
        statusNorm < ValidPaymentStatus.espera ||
        statusNorm > ValidPaymentStatus.reservaAbonada
      ) {
        throw new BadRequestException(
          `status inválido: ${String(status)} (se esperaba entero 0–6)`,
        );
      }

      if (statusNorm === ValidPaymentStatus.cancelado) {
        if (
          !forzarCancelacionConPagoMitad &&
          debeBloquearCancelacionPorPrimeraMitadPagada(reserva)
        ) {
          const destino =
            reserva.reservation?.email?.trim() || 'reservas@gehsuites.com';
          await this.emailsService.enviarCorreoSaldoPendienteIntentoCancelacion(
            reserva,
            destino,
          );
          throw new BadRequestException(
            'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante. Use forzarCancelacionConPagoMitad=true si debe cancelar de forma excepcional.',
          );
        }
        await this.httpCustomService.cancelarReservas(reserva.reservaChatbotId);
      }

      const pagadoPrimeraMitad =
        statusNorm === ValidPaymentStatus.mitad ||
        statusNorm === ValidPaymentStatus.reservaAbonada ||
        statusNorm === ValidPaymentStatus.total;

      const updateResult = await this.reservasModel.updateOne(
        { _id },
        { $set: { status: statusNorm, pagadoPrimeraMitad } },
      );

      if (updateResult.matchedCount === 0) {
        throw new NotFoundException(
          'Reserva no encontrada al aplicar el cambio de estado',
        );
      }

      this.logger.log(
        `actualizarStatusReservaManual _id=${String(_id)} status=${statusNorm} pagadoPrimeraMitad=${pagadoPrimeraMitad} matched=${updateResult.matchedCount} modified=${updateResult.modifiedCount}`,
      );

      const actualizada = await this.reservasModel.findById(_id).exec();
      if (!actualizada) {
        throw new NotFoundException('Reserva no encontrada tras actualizar');
      }

      return actualizada;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}

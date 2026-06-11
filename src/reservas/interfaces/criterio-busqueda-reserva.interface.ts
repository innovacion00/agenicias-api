import { Types } from 'mongoose';
import { ValidPaymentStatus } from './validPaymentStatus.interface';

export type CriterioBusquedaReserva =
  | { tipo: 'agente'; valor: string; page?: number; all?: boolean }
  | { tipo: 'agencia'; valor: string; page?: number; all?: boolean }
  | { tipo: 'huesped'; valor: string; page?: number; all?: boolean }
  | { tipo: 'estado'; valor: ValidPaymentStatus; page?: number; all?: boolean };

export interface ContextoUsuario {
  userId: Types.ObjectId;
  agenciaId: Types.ObjectId;
  roles: string[];
}

export interface RespuestaPaginadaReservas {
  data: any[];
  meta: {
    total: number;
    sumaTotales?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
}

export interface RespuestaChatbotId {
  data: any | null;
  found: boolean;
  sumaTotales?: number;
}

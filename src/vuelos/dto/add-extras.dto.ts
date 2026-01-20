import { 
  IsNotEmpty,
  IsObject,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para agregar extras a un paquete de vuelo en MaarLab Oceanflights
 * La estructura exacta de los extras depende de la API de MaarLab
 */
export class AddExtrasDto {
  @IsNotEmpty()
  @IsObject()
  extras: any; // Estructura flexible para los extras según la respuesta de MaarLab
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChatHistoryItemDto {
  @ApiProperty({
    description: 'Rol del mensaje en el historial',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Contenido del mensaje',
    example: 'Hola, necesito disponibilidad',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatBridgeDto {
  @ApiProperty({
    description: 'Mensaje obligatorio para el bridge',
    example: 'Hola Lucía, necesito disponibilidad en Cartagena para mañana',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'ID opcional del usuario',
    example: 'user-123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'ID opcional de conversación',
    example: 'conv-123',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Historial opcional del chat',
    type: [ChatHistoryItemDto],
    example: [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Hola, ¿en qué te ayudo?' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}

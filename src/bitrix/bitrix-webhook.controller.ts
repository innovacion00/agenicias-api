import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import parsePhoneNumber from 'libphonenumber-js';
import { AgenciasService } from 'src/agencias/agencias.service';
import { AuthService } from 'src/auth/auth.service';
import { Agencia } from 'src/agencias/entities';
import { CreateAgenciaDto } from 'src/agencias/dto/create-agencia.dto';
import { CreateUserDto } from 'src/auth/dto/create-user.dto';

function normalizarTelefono(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!candidate.startsWith('+')) {
    candidate = '+' + candidate;
  }
  const parsed = parsePhoneNumber(candidate);
  if (parsed && parsed.isValid()) {
    return parsed.number;
  }
  if (/^\+\d{7,15}$/.test(candidate)) return candidate;
  return null;
}

function normalizarCategoria(raw?: string | number): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const s = String(raw).trim().toLowerCase();
  if (s === '0' || s === 'minorista' || s === 'min') return 0;
  if (s === '1' || s === 'mayorista' || s === 'mayor' || s === 'may') return 1;
  const n = Number(s);
  if (!isNaN(n) && (n === 0 || n === 1)) return n;
  return 0;
}

function normalizarBooleano(raw?: string): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).trim().toLowerCase();
  if (['1', 'true', 'si', 'sí', 'yes', 'y', 'verdadero'].includes(s)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'falso'].includes(s)) {
    return false;
  }
  return Boolean(s);
}

function limpiarDocumento(raw?: string): string {
  return (raw || '').replace(/[\s.\-,]/g, '').trim();
}

function generarPasswordTemporal(): string {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const all = mayus + minus + nums;
  const chars = Array.from(
    { length: 12 },
    () => all[Math.floor(Math.random() * all.length)],
  );
  chars[2] = mayus[Math.floor(Math.random() * mayus.length)];
  chars[6] = minus[Math.floor(Math.random() * minus.length)];
  chars[10] = nums[Math.floor(Math.random() * nums.length)];
  return chars.join('');
}

@ApiTags('bitrix')
@Controller('agencias')
export class BitrixWebhookController {
  private readonly logger = new Logger(BitrixWebhookController.name);

  constructor(
    private readonly agenciasService: AgenciasService,
    private readonly authService: AuthService,
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
  ) {}

  @Get('create-agencia')
  @ApiOperation({
    summary: 'Crear agencia desde Bitrix (público, vía query params)',
    description:
      'Endpoint público que recibe query params enviados por Bitrix y los mapea al DTO de creación de agencia.',
  })
  @ApiQuery({ name: 'fullName', required: true, description: 'Nombre de la entidad' })
  @ApiQuery({ name: 'emailContacto', required: true, description: 'Email de contacto' })
  @ApiQuery({ name: 'categoria', required: true, description: 'Tipo convenio: 0=Minorista, 1=Mayorista' })
  @ApiQuery({ name: 'document', required: true, description: 'Número de documento (NIT)' })
  @ApiQuery({ name: 'telefonoContacto', required: true, description: 'Teléfono de contacto' })
  @ApiQuery({ name: 'empresa', required: false, description: 'Indica si es empresa (1/0)' })
  @ApiQuery({ name: 'tipoDocumento', required: false, enum: ['CC', 'NIT', 'CE', 'PA'] })
  @ApiQuery({ name: 'dealId', required: false, description: 'ID del deal en Bitrix' })
  async createAgenciaFromBitrixGet(@Query() query: any) {
    return this.handleCreateAgencia(query);
  }

  @Post('create-agencia')
  @ApiOperation({
    summary: 'Crear agencia desde Bitrix (público, vía query params)',
    description:
      'Endpoint público que recibe query params enviados por Bitrix y los mapea al DTO de creación de agencia.',
  })
  @ApiQuery({ name: 'fullName', required: true, description: 'Nombre de la entidad' })
  @ApiQuery({ name: 'emailContacto', required: true, description: 'Email de contacto' })
  @ApiQuery({ name: 'categoria', required: true, description: 'Tipo convenio: 0=Minorista, 1=Mayorista' })
  @ApiQuery({ name: 'document', required: true, description: 'Número de documento (NIT)' })
  @ApiQuery({ name: 'telefonoContacto', required: true, description: 'Teléfono de contacto' })
  @ApiQuery({ name: 'empresa', required: false, description: 'Indica si es empresa (1/0)' })
  @ApiQuery({ name: 'tipoDocumento', required: false, enum: ['CC', 'NIT', 'CE', 'PA'] })
  @ApiQuery({ name: 'dealId', required: false, description: 'ID del deal en Bitrix' })
  async createAgenciaFromBitrixPost(@Query() query: any) {
    return this.handleCreateAgencia(query);
  }

  private async handleCreateAgencia(@Query() query: any) {
    try {
      return await this.ejecutarCreateAgencia(query);
    } catch (err: any) {
      this.logger.error(
        `[bitrix] ❌ create-agencia falló (dealId=${query?.dealId}): ${
          err?.message || err
        }`,
      );
      throw err;
    }
  }

  private async ejecutarCreateAgencia(query: any) {
    this.logger.log(
      `[bitrix] create-agencia recibido: ${JSON.stringify(query)}`,
    );

    const fullName = query?.fullName?.trim();
    const emailContacto = query?.emailContacto?.trim();
    const telefonoContacto = normalizarTelefono(query?.telefonoContacto);
    const document = limpiarDocumento(query?.document);
    const categoria = normalizarCategoria(query?.categoria);
    const empresa = normalizarBooleano(query?.empresa);
    const tipoDocumento = ['CC', 'NIT', 'CE', 'PA'].includes(
      query?.tipoDocumento,
    )
      ? query.tipoDocumento
      : 'NIT';
    const dealId = query?.dealId;

    if (!fullName) {
      throw new BadRequestException('Falta el parámetro fullName');
    }
    if (!emailContacto) {
      throw new BadRequestException('Falta el parámetro emailContacto');
    }
    if (!telefonoContacto) {
      throw new BadRequestException('Falta o es inválido telefonoContacto');
    }
    if (document.length < 6) {
      throw new BadRequestException(
        `document inválido (mínimo 6 caracteres): "${document}"`,
      );
    }

    const dto: CreateAgenciaDto = {
      fullName,
      emailContacto,
      telefonoContacto,
      category: categoria,
      documentInfo: {
        tipo: tipoDocumento,
        document,
      },
    };
    if (empresa !== undefined) dto.empresa = empresa;

    this.logger.log(
      `[bitrix] create-agencia mapeado: nombre="${fullName}", categoria=${categoria}, document=${document}, tel=${telefonoContacto}, empresa=${empresa ?? false}, dealId=${dealId}`,
    );

    const resultado = await this.agenciasService.create(dto);

    this.logger.log(
      `[bitrix] ✅ create-agencia completado: dealId=${dealId}, agencia=${resultado?.agencia?._id}`,
    );
    return {
      success: true,
      message: 'Agencia creada exitosamente',
      dealId,
      agenciaId: resultado?.agencia?._id,
      resultado,
    };
  }

  @Get('create-user')
  @ApiOperation({
    summary: 'Crear usuario desde Bitrix (público, vía query params)',
    description:
      'Endpoint público que recibe query params enviados por Bitrix, resuelve la agencia y crea el usuario.',
  })
  @ApiQuery({ name: 'agenciaId', required: true, description: 'ID agencia en Booking Connect (MongoId o Autocore id)' })
  @ApiQuery({ name: 'email', required: true, description: 'Email del usuario' })
  @ApiQuery({ name: 'nombre', required: true, description: 'Nombre completo del usuario' })
  @ApiQuery({ name: 'telefono', required: true, description: 'Teléfono del usuario' })
  @ApiQuery({ name: 'omitirOtp', required: false, description: '1/0 para omitir validación OTP' })
  @ApiQuery({ name: 'dealId', required: false, description: 'ID del deal en Bitrix' })
  async createUserFromBitrixGet(@Query() query: any) {
    return this.handleCreateUser(query);
  }

  @Post('create-user')
  @ApiOperation({
    summary: 'Crear usuario desde Bitrix (público, vía query params)',
    description:
      'Endpoint público que recibe query params enviados por Bitrix, resuelve la agencia y crea el usuario.',
  })
  @ApiQuery({ name: 'agenciaId', required: true, description: 'ID agencia en Booking Connect (MongoId o Autocore id)' })
  @ApiQuery({ name: 'email', required: true, description: 'Email del usuario' })
  @ApiQuery({ name: 'nombre', required: true, description: 'Nombre completo del usuario' })
  @ApiQuery({ name: 'telefono', required: true, description: 'Teléfono del usuario' })
  @ApiQuery({ name: 'omitirOtp', required: false, description: '1/0 para omitir validación OTP' })
  @ApiQuery({ name: 'dealId', required: false, description: 'ID del deal en Bitrix' })
  async createUserFromBitrixPost(@Query() query: any) {
    return this.handleCreateUser(query);
  }

  private async handleCreateUser(@Query() query: any) {
    try {
      return await this.ejecutarCreateUser(query);
    } catch (err: any) {
      this.logger.error(
        `[bitrix] ❌ create-user falló (dealId=${query?.dealId}): ${
          err?.message || err
        }`,
      );
      throw err;
    }
  }

  private async ejecutarCreateUser(query: any) {
    this.logger.log(
      `[bitrix] create-user recibido: ${JSON.stringify(query)}`,
    );

    const agenciaIdentifier = query?.agenciaId?.trim();
    const email = query?.email?.trim();
    const fullName = query?.nombre?.trim();
    const telefono = normalizarTelefono(query?.telefono);
    const dealId = query?.dealId;

    if (!agenciaIdentifier) {
      throw new BadRequestException('Falta el parámetro agenciaId');
    }
    if (!email) {
      throw new BadRequestException('Falta el parámetro email');
    }
    if (!fullName || fullName.length < 2) {
      throw new BadRequestException('Falta el parámetro nombre');
    }
    if (!telefono) {
      throw new BadRequestException('Falta o es inválido el parámetro telefono');
    }

    const agenciaMongoId = await this.resolveAgenciaMongoId(agenciaIdentifier);
    if (!agenciaMongoId) {
      throw new BadRequestException(
        `No se encontró una agencia con el identificador: "${agenciaIdentifier}"`,
      );
    }
    this.logger.log(
      `[bitrix] create-user agencia resuelta: "${agenciaIdentifier}" → ${agenciaMongoId}`,
    );

    const passwordTemporal = generarPasswordTemporal();
    const omitirOtp = normalizarBooleano(query?.omitirOtp) ?? false;

    const dto: CreateUserDto = {
      email,
      fullName,
      telefono,
      password: passwordTemporal,
      omitirOtp,
    };

    this.logger.log(
      `[bitrix] create-user mapeado: email=${email}, nombre="${fullName}", agenciaMongoId=${agenciaMongoId}, omitirOtp=${omitirOtp}, dealId=${dealId}`,
    );

    const resultado = await this.authService.createUser(
      dto,
      String(agenciaMongoId),
    );

    this.logger.log(
      `[bitrix] ✅ create-user completado: email=${email}, dealId=${dealId}, agencia=${agenciaMongoId}`,
    );
    return {
      success: true,
      message: 'Usuario creado exitosamente',
      dealId,
      agenciaId: agenciaMongoId,
      email,
      passwordTemporal,
      resultado,
    };
  }

  private async resolveAgenciaMongoId(
    identifier: string,
  ): Promise<Types.ObjectId | null> {
    if (Types.ObjectId.isValid(identifier)) {
      const doc = await this.agenciaModel
        .findById(identifier)
        .select('_id')
        .lean();
      if (doc) return doc._id as Types.ObjectId;
    }

    const numId = parseInt(identifier, 10);
    if (!isNaN(numId)) {
      const doc = await this.agenciaModel
        .findOne({ 'autocoreInfo.id': numId })
        .select('_id')
        .lean();
      if (doc) return doc._id as Types.ObjectId;
    }

    const doc = await this.agenciaModel
      .findOne({ 'cobreInfo.bolcilloId': identifier })
      .select('_id')
      .lean();
    if (doc) return doc._id as Types.ObjectId;

    return null;
  }
}
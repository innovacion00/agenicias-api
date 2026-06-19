import 'dotenv/config';
import * as joi from 'joi';

// API_1525: string;
interface EnvVars {
  /** CONFIG: Puerto en el que escucha la aplicación */
  PORT: number;

  /** CONFIG: URL de conexión a MongoDB */
  MONGO_URL: string;

  /** SECRET: Clave secreta para firmar JWT tokens */
  JWT_SECRET: string;

  //? Cobre
  /** CONFIG: URL base del API de Cobre */
  COBRE_API_URL: string;
  /** SECRET: ID de usuario en Cobre */
  COBRE_USER_ID: string;
  /** SECRET: Clave secreta de Cobre */
  COBRE_SECRET: string;
  /** SECRET: String de autenticación para Cobre */
  COBRE_AUTH_STRING: string;
  /** SECRET: Clave API de Cobre */
  COBRE_API_KEY: string;

  //? Cloudinary
  /** CONFIG: Nombre de la cuenta Cloudinary */
  CLOUDINARY_NAME: string;
  /** SECRET: Clave de API de Cloudinary */
  CLOUDINARY_API_KEY: string;
  /** SECRET: Clave secreta de Cloudinary */
  CLOUDINARY_API_SECRET: string;

  //? Node_Mailer
  /** CONFIG: Email remitente para envíos vía Nodemailer */
  SENDER_EMAIL: string;
  /** SECRET: Contraseña de aplicación de Gmail */
  EMAIL_APP_PASSWORD: string;

  //? SEND GRID
  /** SECRET: Clave API de SendGrid */
  SENDGRID_API_KEY: string;

  //? Google Gmail API
  /** SECRET: Access Token del API de Google Gmail (se refresca automáticamente) */
  GOOGLE_GMAIL_API_KEY: string;
  /** CONFIG: URL del API de Google Gmail */
  GOOGLE_GMAIL_URL: string;
  /** SECRET: ID de cliente de Google */
  GOOGLE_GMAIL_CLIENT_ID: string;
  /** SECRET: Clave secreta de cliente de Google */
  GOOGLE_GMAIL_CLIENT_SECRET: string;
  /** SECRET: Refresh Token para obtener nuevos access tokens */
  GOOGLE_GMAIL_REFRESH_TOKEN: string;

  //? Autocore
  /** CONFIG: URL base del API de Autocore */
  AUTOCORE_URL: string;
  /** SECRET: Clave de acceso para Autocore */
  AUTOCORE_ACCESS_KEY: string;
  /** SECRET: Clave secreta para Autocore */
  AUTOCORE_SECRET_KEY: string;

  //? Autocore dev
  /** CONFIG: URL base del API de Autocore (development) - opcional */
  AUTOCORE_URL_DEV?: string;
  /** SECRET: Clave de acceso para Autocore (development) - opcional */
  AUTOCORE_ACCESS_KEY_DEV?: string;
  /** SECRET: Clave secreta para Autocore (development) - opcional */
  AUTOCORE_SECRET_KEY_DEV?: string;

  //? My Tool
  /** CONFIG: Email de cuenta My Tool */
  MY_TOOL_EMAIL: string;
  /** SECRET: Contraseña de acceso My Tool */
  MY_TOOL_CLAVE: string;

  /** SECRET: URL de API para hotel Aixo (My Tool) */
  API_AIXO: string;
  /** SECRET: URL de API para hotel Azuán (My Tool) */
  API_AZUAN: string;
  /** SECRET: URL de API para hotel Rodadero (My Tool) */
  API_RODADERO: string;
  /** SECRET: URL de API para hotel Avexi (My Tool) */
  API_AVEXI: string;
  /** SECRET: URL de API para hotel Bocagrande (My Tool) */
  API_BOCAGRANADE: string;
  /** SECRET: URL de API para hotel Abí (My Tool) */
  API_ABI: string;
  /** SECRET: URL de API para hotel Madisson (My Tool) */
  API_MADISSON: string;
  /** SECRET: URL de API para hotel Windsor (My Tool) */
  API_WINDSOR: string;
  /** SECRET: URL de API para hotel Marina (My Tool) */
  API_MARINA: string;
  /** SECRET: URL de API para hotel Axis (My Tool) */
  API_AXIS: string;
  /** SECRET: URL de API para hotel Marqués (My Tool) */
  API_MARQUES: string;
  /** SECRET: URL de API para hotel Sansiraka (My Tool) */
  API_SANSIRAKA: string;
  /** SECRET: URL de API para hotel Playa Salguero (My Tool) */
  API_PLAYASALGUERO: string;

  //? Amadeus
  /** SECRET: Clave de API de Amadeus */
  AMADEUS_API_KEY: string;
  /** SECRET: Clave secreta de Amadeus */
  AMADEUS_API_SECRET: string;
  /** CONFIG: URL base del API de Amadeus */
  AMADEUS_BASE_URL: string;

  //? Booking Personas
  /** SECRET: Token de autenticación para Booking Personas */
  BOOKING_PERSONAS_TOKEN: string;

  //? MaarLab
  /** CONFIG: URL base del API de MaarLab */
  MAARLAB_BASE_URL: string;
  /** @deprecated El Bearer por solicitud sale de Agencia.maarlabApiKey */
  MAARLAB_AUTH_TOKEN?: string;
  /** SECRET: Bearer de nivel partner para script `sync:maarlab-keys` (listar api_keys_by_partner) - opcional */
  MAARLAB_PARTNER_SYNC_BEARER?: string;
  /** CONFIG: UUID cadena MaarLab (`id_chain_search_engine`) para el script de sincronización - opcional */
  MAARLAB_CHAIN_SEARCH_ENGINE_ID?: string;

  //? Bridge Chat
  /** CONFIG: URL del host Bridge Chat */
  HOST_BRIDGE: string;
}

// API_1525: joi.string().required(),
const envSchema = joi
  .object({
    PORT: joi.number().required(),

    MONGO_URL: joi.string().required(),

    JWT_SECRET: joi.string().required(),

    //? Cobre
    COBRE_API_URL: joi.string().required(),
    COBRE_USER_ID: joi.string().required(),
    COBRE_SECRET: joi.string().required(),
    COBRE_AUTH_STRING: joi.string().required(),
    COBRE_API_KEY: joi.string().required(),

    //? Cloudinary
    CLOUDINARY_NAME: joi.string().required(),
    CLOUDINARY_API_KEY: joi.string().required(),
    CLOUDINARY_API_SECRET: joi.string().required(),

    //? Node_Mailer
    EMAIL_APP_PASSWORD: joi.string().required(),
    SENDER_EMAIL: joi.string().required(),

    //? SEND GRID
    SENDGRID_API_KEY: joi.string().required(),

    //? Google Gmail API
    GOOGLE_GMAIL_API_KEY: joi.string().required(),
    GOOGLE_GMAIL_URL: joi.string().required(),
    GOOGLE_GMAIL_CLIENT_ID: joi.string().required(),
    GOOGLE_GMAIL_CLIENT_SECRET: joi.string().required(),
    GOOGLE_GMAIL_REFRESH_TOKEN: joi.string().required(),

    //? Autocore
    AUTOCORE_URL: joi.string().required(),
    AUTOCORE_ACCESS_KEY: joi.string().required(),
    AUTOCORE_SECRET_KEY: joi.string().required(),

    //? Autocore dev
    AUTOCORE_URL_DEV: joi.string().optional(),
    AUTOCORE_ACCESS_KEY_DEV: joi.string().optional(),
    AUTOCORE_SECRET_KEY_DEV: joi.string().optional(),

    //? My Tool
    MY_TOOL_EMAIL: joi.string().required(),
    MY_TOOL_CLAVE: joi.string().required(),
    API_AIXO: joi.string().required(),
    API_AZUAN: joi.string().required(),
    API_RODADERO: joi.string().required(),
    API_AVEXI: joi.string().required(),
    API_BOCAGRANADE: joi.string().required(),
    API_ABI: joi.string().required(),
    API_MADISSON: joi.string().required(),
    API_WINDSOR: joi.string().required(),
    API_MARINA: joi.string().required(),
    API_AXIS: joi.string().required(),
    API_MARQUES: joi.string().required(),
    API_SANSIRAKA: joi.string().required(),
    API_PLAYASALGUERO: joi.string().required(),

    //? Amadeus
    AMADEUS_API_KEY: joi.string().required(),
    AMADEUS_API_SECRET: joi.string().required(),
    AMADEUS_BASE_URL: joi.string().required(),

    //? Booking Personas
    BOOKING_PERSONAS_TOKEN: joi.string().required(),

    //? MaarLab
    MAARLAB_BASE_URL: joi.string().required(),
    MAARLAB_AUTH_TOKEN: joi.string().allow('').optional().default(''),
    MAARLAB_PARTNER_SYNC_BEARER: joi.string().allow('').optional().default(''),
    MAARLAB_CHAIN_SEARCH_ENGINE_ID: joi
      .string()
      .allow('')
      .optional()
      .default(''),

    //? Bridge Chat
    HOST_BRIDGE: joi.string().required(),
  })
  .unknown(true);

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

// api1525: envVars.API_1525,
export const envs = {
  port: envVars.PORT,

  mongoUrl: envVars.MONGO_URL,

  jwtSecret: envVars.JWT_SECRET,

  //? Cobre
  cobreApiUrl: envVars.COBRE_API_URL,
  cobreUserId: envVars.COBRE_USER_ID,
  cobreSecret: envVars.COBRE_SECRET,
  cobreAuthString: envVars.COBRE_AUTH_STRING,
  cobreApiKey: envVars.COBRE_API_KEY,

  //? Cloudinary
  cloudinaryName: envVars.CLOUDINARY_NAME,
  cloudinaryApiKey: envVars.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: envVars.CLOUDINARY_API_SECRET,

  //? Node_Mailer
  senderEmail: envVars.SENDER_EMAIL,
  emailAppPassword: envVars.EMAIL_APP_PASSWORD,

  //? SEND GRID
  sendgridApiKey: envVars.SENDGRID_API_KEY,

  //? Google Gmail API
  googleGmailApiKey: envVars.GOOGLE_GMAIL_API_KEY,
  googleGmailUrl: envVars.GOOGLE_GMAIL_URL,
  googleGmailClientId: envVars.GOOGLE_GMAIL_CLIENT_ID,
  googleGmailClientSecret: envVars.GOOGLE_GMAIL_CLIENT_SECRET,
  googleGmailRefreshToken: envVars.GOOGLE_GMAIL_REFRESH_TOKEN,

  //? Autocore
  autocoreUrl: envVars.AUTOCORE_URL,
  autocoreAccessKey: envVars.AUTOCORE_ACCESS_KEY,
  autocoreSecretKey: envVars.AUTOCORE_SECRET_KEY,

  //? Autocore Dev
  autocoreUrlDev: envVars.AUTOCORE_URL_DEV,
  autocoreAccessKeyDev: envVars.AUTOCORE_ACCESS_KEY_DEV,
  autocoreSecretKeyDev: envVars.AUTOCORE_SECRET_KEY_DEV,

  //? My Tool
  myToolEmail: envVars.MY_TOOL_EMAIL,
  myToolClave: envVars.MY_TOOL_CLAVE,
  apiAixo: envVars.API_AIXO,
  apiAzuan: envVars.API_AZUAN,
  apiRodadero: envVars.API_RODADERO,
  apiAvexi: envVars.API_AVEXI,
  apiBocagrande: envVars.API_BOCAGRANADE,
  apiAbi: envVars.API_ABI,
  apiMadisson: envVars.API_MADISSON,
  apiWindsor: envVars.API_WINDSOR,
  apiMarina: envVars.API_MARINA,
  apiAxis: envVars.API_AXIS,
  apiMarques: envVars.API_MARQUES,
  apiSansiraka: envVars.API_SANSIRAKA,
  apiPlayaSalguero: envVars.API_PLAYASALGUERO,

  //? Amadeus
  amadeusApiKey: envVars.AMADEUS_API_KEY,
  amadeusApiSecret: envVars.AMADEUS_API_SECRET,
  amadeusBaseUrl: envVars.AMADEUS_BASE_URL,

  //? Booking Personas
  bookingPersonasToken: envVars.BOOKING_PERSONAS_TOKEN,

  //? MaarLab
  maarlabBaseUrl: envVars.MAARLAB_BASE_URL,
  /** Legado; no usar para Authorization hacia OceanFlights. */
  maarlabAuthToken: envVars.MAARLAB_AUTH_TOKEN ?? '',
  /** Partner: listar API keys (script sync). */
  maarlabPartnerSyncBearer: envVars.MAARLAB_PARTNER_SYNC_BEARER ?? '',
  /** UUID cadena para `id_chain_search_engine`. */
  maarlabChainSearchEngineId: envVars.MAARLAB_CHAIN_SEARCH_ENGINE_ID ?? '',

  //? Bridge Chat
  hostBridge: envVars.HOST_BRIDGE,
};

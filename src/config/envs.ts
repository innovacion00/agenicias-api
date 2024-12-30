import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;

  MONGO_URL: string;

  JWT_SECRET: string;

  // ? Cobre
  COBRE_API_URL: string;
  COBRE_USER_ID: string;
  COBRE_SECRET: string;
  COBRE_AUTH_STRING: string;
  COBRE_API_KEY: string;

  // ? Node_Mailer
  SENDER_EMAIL: string;
  EMAIL_APP_PASSWORD: string;

  // ? Autocore Dev
  AUTOCORE_URL: string;
  AUTOCORE_ACCESS_KEY: string;
  AUTOCORE_SECRET_KEY: string;

  // ? My Tool
  MY_TOOL_EMAIL: string;
  MY_TOOL_CLAVE: string;

  API_1525: string;
  API_AIXO: string;
  API_AZUAN: string;
  API_RODADERO: string;
  API_AVEXI: string;
  API_BOCAGRANADE: string;
  API_ABI: string;
  API_MADISSON: string;
  API_WINDSOR: string;
  API_MARINA: string;
  API_AXIS: string;
}

const envSchema = joi
  .object({
    PORT: joi.number().required(),

    MONGO_URL: joi.string().required(),

    JWT_SECRET: joi.string().required(),

    // ? Cobre
    COBRE_API_URL: joi.string().required(),
    COBRE_USER_ID: joi.string().required(),
    COBRE_SECRET: joi.string().required(),
    COBRE_AUTH_STRING: joi.string().required(),
    COBRE_API_KEY: joi.string().required(),

    // ? Node_Mailer
    EMAIL_APP_PASSWORD: joi.string().required(),
    SENDER_EMAIL: joi.string().required(),

    // ? Autocore Dev
    AUTOCORE_URL: joi.string().required(),
    AUTOCORE_ACCESS_KEY: joi.string().required(),
    AUTOCORE_SECRET_KEY: joi.string().required(),

    // ? My Tool
    MY_TOOL_EMAIL: joi.string().required(),
    MY_TOOL_CLAVE: joi.string().required(),

    API_1525: joi.string().required(),
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
  })
  .unknown(true);

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,

  mongoUrl: envVars.MONGO_URL,

  jwtSecret: envVars.JWT_SECRET,

  // ? Cobre
  cobreApiUrl: envVars.COBRE_API_URL,
  cobreUserId: envVars.COBRE_USER_ID,
  cobreSecret: envVars.COBRE_SECRET,
  cobreAuthString: envVars.COBRE_AUTH_STRING,
  cobreApiKey: envVars.COBRE_API_KEY,

  // ? Node_Mailer
  senderEmail: envVars.SENDER_EMAIL,
  emailAppPassword: envVars.EMAIL_APP_PASSWORD,

  // ? Autocore Dev
  autocoreUrl: envVars.AUTOCORE_URL,
  autocoreAccessKey: envVars.AUTOCORE_ACCESS_KEY,
  autocoreSecretKey: envVars.AUTOCORE_SECRET_KEY,

  // ? My Tool
  myToolEmail: envVars.MY_TOOL_EMAIL,
  myToolClave: envVars.MY_TOOL_CLAVE,
  api1525: envVars.API_1525,
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
};

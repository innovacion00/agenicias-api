import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;

  MONGO_URL: string;

  JWT_SECRET: string;

  // ? Cobre
  COBRE_API_URL: string;
  COBRE_AUTH_STRING: string;
  COBRE_API_KEY: string;

  // ? Node_Mailer
  SENDER_EMAIL: string;
  EMAIL_APP_PASSWORD: string;

  // ? My Tool
  MY_TOOL_EMAIL: string;
  MY_TOOL_CLAVE: string;
  API_1525: string;
}

const envSchema = joi
  .object({
    PORT: joi.number().required(),

    MONGO_URL: joi.string().required(),

    JWT_SECRET: joi.string().required(),

    COBRE_API_URL: joi.string().required(),
    COBRE_AUTH_STRING: joi.string().required(),
    COBRE_API_KEY: joi.string().required(),

    EMAIL_APP_PASSWORD: joi.string().required(),
    SENDER_EMAIL: joi.string().required(),

    MY_TOOL_EMAIL: joi.string().required(),
    MY_TOOL_CLAVE: joi.string().required(),
    API_1525: joi.string().required(),
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

  cobreApiUrl: envVars.COBRE_API_URL,
  cobreAuthString: envVars.COBRE_AUTH_STRING,
  cobreApiKey: envVars.COBRE_API_KEY,

  SENDER_EMAIL: envVars.SENDER_EMAIL,
  EMAIL_APP_PASSWORD: envVars.EMAIL_APP_PASSWORD,

  myToolEmail: envVars.MY_TOOL_EMAIL,
  myToolClave: envVars.MY_TOOL_CLAVE,
  api_1525: envVars.API_1525,
};

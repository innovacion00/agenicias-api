/**
 * @deprecated Barrel de RE-EXPORT temporal (PR-2.2 de la Fase 2).
 * Los contratos de Autocore viven ahora en `src/autocore/interfaces` y los de
 * Cobre en `src/cobre/interfaces`. Este barrel solo re-exporta para no tocar
 * los imports de los features; PR-2.8 los migra y elimina este archivo.
 * `VueloMaarLabEntry` no es contrato Autocore: PR-2.8 lo mueve a
 * `src/cotizaciones/interfaces/`.
 */
export * from 'src/autocore/interfaces';
export * from 'src/cobre/interfaces';
export * from './reserva/vuelo-maarlab.interface';

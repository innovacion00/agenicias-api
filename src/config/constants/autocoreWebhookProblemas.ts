/**
 * Lista de ObjectIds de reservas que el webhook de Autocore debe ignorar.
 *
 * Estas reservas fueron duplicadas o corruptas históricamente y no deben
 * procesar eventos de pago. Se evalúa en cambiarEstadoPagoAutocore() como
 * early-exit (idempotencia).
 *
 * IMPORTANTE: No modifica directamente. Agregar/remover solo con revisión
 * de arquitectura. Cada ID debe documentar fecha y razón.
 *
 * Historial:
 * - 67ab755cedb19b9bad39f22d: Duplicada Jun 2026 (test Autocore)
 * - 67ab7863edb19b9bad3a4471: Corrupción parcial (missing field)
 * - 67cefa09a0c53ce8c5e1fb9b: Test remanente (limpieza fallida)
 * - 67bf4b1a7b358f891dce8926: Pago phantom (sin huésped vinculado)
 * - 67c084a87b358f891dd07448: Webhook truncado (integridad)
 * - 67c761d2be7b7404574c2513: Migración fallida (Jul 2026)
 */
export const AUTOCORE_WEBHOOK_RESERVAS_IGNORADAS = [
  '67ab755cedb19b9bad39f22d',
  '67ab7863edb19b9bad3a4471',
  '67cefa09a0c53ce8c5e1fb9b',
  '67bf4b1a7b358f891dce8926',
  '67c084a87b358f891dd07448',
  '67c761d2be7b7404574c2513',
];

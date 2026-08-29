/**
 * Cuentas bancarias por grupo de hoteles, usadas en el modal de "Subir
 * comprobante" del motor de agencias. `bitrixId` es el ID del ítem en el campo
 * UF_CRM_1719335914 (Razón social) de Bitrix.
 *
 * Vivían hardcodeadas en el frontend; se movieron aquí para no exponer
 * números de cuenta y NIT en el bundle público. Se sirven por
 * GET /agencias/v1/reservas/cuentas-bancarias (requiere JWT).
 */
export const CUENTAS_BANCARIAS = {
  aixo: {
    label: 'Econo Hotel Group',
    bitrixId: 6142,
    accounts: [
      { banco: 'Banco Davivienda', titular: 'Econo Hotel Group', tipo: 'Cuenta Corriente', numero: '057169988813', nit: '901116843-1' },
      { banco: 'Banco Bancolombia', titular: 'Econo Hotel Group', tipo: 'Cuenta Corriente', numero: '09800001143', nit: '901116843-1' },
    ],
  },
  marina_madisson: {
    label: 'Dt Hoteles & Inn s.a.s',
    bitrixId: 6146,
    accounts: [
      { banco: 'Banco Davivienda', titular: 'DT HOTELES & INN S.A.S', tipo: 'Cuenta Corriente', numero: '0571-6999 0330', nit: '900.725.984-9' },
      { banco: 'Banco Bancolombia', titular: 'DT HOTELES & INN SAS', tipo: 'Cuenta Corriente', numero: '098-000011-52', nit: '900.725.984-9' },
    ],
  },
  azuan_avexi_rodadero_axis: {
    label: 'Caribe Hoteles & Suites s.a.s',
    bitrixId: 6144,
    accounts: [
      { banco: 'Banco Davivienda', titular: 'Caribe Hoteles & suites S.A.S', tipo: 'Cuenta Corriente', numero: '057169989969', nit: '900 801 256-0' },
      { banco: 'Banco Bancolombia', titular: 'Caribe Hoteles & suites S.A.S', tipo: 'Cuenta Corriente', numero: '098-0000-1054', nit: '900 801 256-0' },
    ],
  },
  abi_sansiraka: {
    label: 'Smart Stay s.a.s',
    bitrixId: 6148,
    accounts: [
      { banco: 'Banco Bancolombia', titular: 'SMART STAY SAS', tipo: 'Cuenta Corriente', numero: '08500008723', nit: '901691840-2' },
      { banco: 'Banco Davivienda', titular: 'SMART STAY SAS', tipo: 'Cuenta Corriente', numero: '057169987054', nit: '901691840-2' },
    ],
  },
  windsor: {
    label: 'Sociedad Hotelera Fam sas',
    bitrixId: 7106,
    accounts: [
      { banco: 'Banco Bancolombia', titular: 'SOCIEDAD HOTELERA FAM SAS', tipo: 'Cuenta Corriente', numero: '085-000088-34', nit: '901718424' },
    ],
  },
  boquilla: {
    label: 'Jarsy Eslyn Barboza Calvo',
    bitrixId: 13416,
    accounts: [
      { banco: 'Bancolombia', titular: 'JARSY ESLYN BARBOZA CALVO', tipo: 'Cuenta de Ahorros', numero: '09800008957' },
    ],
  },
  playa_salguero: {
    label: 'Evelyn Rios',
    bitrixId: 13680,
    accounts: [
      { banco: 'Bancolombia', titular: 'EVELYN RIOS', tipo: 'Cuenta de Ahorros', numero: '098-0000-19-82' },
    ],
  },
};
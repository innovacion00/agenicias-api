/**
 * Tests unitarios de MyToolBookingService (motor de reservas de hotel).
 *
 * Punto clave de dinero: este servicio reenvía el body de booking VERBATIM a
 * My Tool (el filtrado de campos solo-BD ocurre aguas arriba, en
 * ReservasService.createReservaMyTool — ver reservas.service.mytool-booking.spec.ts).
 * Aquí se asegura que no haya transformación oculta, el manejo de token,
 * la normalización de URLs y el body exacto de cancelación.
 */
import axios from 'axios';

import { MyToolBookingService } from './my-tool-booking.service';
import {
  MY_TOOL_CANAL_VENTA_ID,
  MY_TOOL_MAQUINA_ID,
} from 'src/config/constants/myToolBookingConstants';

// envs valida ~40 variables al importarse; se reemplaza por valores dummy.
jest.mock('src/config/envs', () => ({
  envs: new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === 'string' ? `http://${prop.toLowerCase()}.test` : '',
    },
  ),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  AxiosError: jest.requireActual('axios').AxiosError,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MyToolBookingService', () => {
  let service: MyToolBookingService;

  const TOKEN = 'token-mytool-abc';

  /** Resuelve la autenticación con un token fijo. */
  const mockAuthOk = () =>
    mockedAxios.post.mockResolvedValueOnce({
      data: { token: TOKEN, valido: '2099-01-01' },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MyToolBookingService();
  });

  describe('authenticate (token y caché)', () => {
    it('hace POST a /api/Autenticacion/Validar con las credenciales de envs y devuelve el token', async () => {
      mockAuthOk();

      const token = await service.authenticate('http://hotel-a.test');

      expect(token).toBe(TOKEN);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://hotel-a.test/api/Autenticacion/Validar',
        {
          correo: 'http://mytoolemail.test',
          clave: 'http://mytoolclave.test',
        },
        { timeout: 15000 },
      );
    });

    it('cachea el token por host: la segunda llamada no vuelve a pegarle a My Tool', async () => {
      mockAuthOk();

      await service.authenticate('http://hotel-a.test');
      const segundo = await service.authenticate('http://hotel-a.test');

      expect(segundo).toBe(TOKEN);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('normaliza la URL para la clave de caché: con y sin slash final comparten token', async () => {
      mockAuthOk();

      await service.authenticate('http://hotel-a.test///');
      await service.authenticate('http://hotel-a.test');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('forceRefresh=true ignora la caché y renueva el token', async () => {
      mockAuthOk();
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'token-nuevo', valido: '2099-01-01' },
      });

      await service.authenticate('http://hotel-a.test');
      const renovado = await service.authenticate('http://hotel-a.test', true);

      expect(renovado).toBe('token-nuevo');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('repara el esquema duplicado típico de .env (http://http://host)', async () => {
      mockAuthOk();

      await service.authenticate('http://http://10.20.30.40/');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://10.20.30.40/api/Autenticacion/Validar',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('createBooking (envío del payload de reserva)', () => {
    // El slug 'aixo' existe en hotelMyToolConfig; con el mock de envs su ip
    // queda determinista en http://apiaixo.test
    const SLUG = 'aixo';
    const BOOKING_URL =
      'http://apiaixo.test/api/BookingAvailability/GetBookAvail';

    it('reenvía el body EXACTO (misma referencia, sin agregar ni quitar campos) con Bearer token', async () => {
      mockAuthOk();
      mockedAxios.post.mockResolvedValueOnce({
        data: { isSuccess: true, message: 'ok', localizador: 'CB123' },
      });

      const body = {
        hotelId: 9001,
        checkIn: '2026-07-01',
        checkOut: '2026-07-04',
        usuario: 'agente',
        maquinaId: 1,
        bookData: { acuerdos: 'media pension', localizador: 'CBAAAA1111' },
        rooms: [{ categoriaId: 2, paxAdultos: 2, paxChilds: 0 }],
      };
      const copia = JSON.parse(JSON.stringify(body));

      const res = await service.createBooking(SLUG, body);

      expect(res.localizador).toBe('CB123');
      // la última llamada a post es el booking (la primera fue la auth)
      const [url, bodyEnviado, opciones] = mockedAxios.post.mock.calls[1];
      expect(url).toBe(BOOKING_URL);
      expect(bodyEnviado).toBe(body); // misma referencia: cero transformación
      expect(bodyEnviado).toEqual(copia); // y sin mutaciones
      expect(opciones).toEqual({
        headers: { Authorization: `Bearer ${TOKEN}` },
        timeout: 60000,
      });
    });

    it('si My Tool responde 401, renueva el token (forceRefresh) y reintenta UNA vez', async () => {
      mockAuthOk(); // auth inicial
      const error401: any = new Error('Unauthorized');
      error401.response = { status: 401 };
      mockedAxios.post.mockRejectedValueOnce(error401); // booking falla 401
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'token-renovado', valido: '2099-01-01' },
      }); // re-auth
      mockedAxios.post.mockResolvedValueOnce({
        data: { isSuccess: true, message: 'ok', localizador: 'CB777' },
      }); // reintento

      const res = await service.createBooking(SLUG, { bookData: {} });

      expect(res.localizador).toBe('CB777');
      expect(mockedAxios.post).toHaveBeenCalledTimes(4);
      const reintento = mockedAxios.post.mock.calls[3];
      expect(reintento[2]).toEqual({
        headers: { Authorization: 'Bearer token-renovado' },
        timeout: 60000,
      });
    });

    it('un error distinto de 401 se propaga sin reintento', async () => {
      mockAuthOk();
      const error500: any = new Error('boom');
      error500.response = { status: 500 };
      mockedAxios.post.mockRejectedValueOnce(error500);

      await expect(service.createBooking(SLUG, { bookData: {} })).rejects.toBe(
        error500,
      );
      // auth + 1 intento de booking, nada más
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('rechaza un slug de hotel no configurado sin tocar la red', async () => {
      await expect(
        service.createBooking('hotel-fantasma', { bookData: {} }),
      ).rejects.toThrow("Hotel slug 'hotel-fantasma' no configurado en MyTool");
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking (body exacto de cancelación)', () => {
    const CANCEL_URL =
      'http://apiaixo.test/api/BookingAvailability/cancelBookAvail';

    it('sin canalVentaId usa los defaults de negocio (canal 41, máquina 1)', async () => {
      mockAuthOk();
      mockedAxios.post.mockResolvedValueOnce({
        data: { isSuccess: true, message: 'cancelada' },
      });

      await service.cancelBooking('aixo', 'CB999', 'agente@geh.com');

      const [url, body] = mockedAxios.post.mock.calls[1];
      expect(url).toBe(CANCEL_URL);
      expect(body).toEqual({
        localizador: 'CB999',
        canalVentaId: MY_TOOL_CANAL_VENTA_ID, // 41
        usuarioCancela: 'agente@geh.com',
        maquinaId: MY_TOOL_MAQUINA_ID, // 1
      });
    });

    it('respeta canalVentaId y maquinaId explícitos', async () => {
      mockAuthOk();
      mockedAxios.post.mockResolvedValueOnce({
        data: { isSuccess: true, message: 'cancelada' },
      });

      await service.cancelBooking('aixo', 'CB999', 'agente', 7, 3);

      const [, body] = mockedAxios.post.mock.calls[1];
      expect(body).toEqual({
        localizador: 'CB999',
        canalVentaId: 7,
        usuarioCancela: 'agente',
        maquinaId: 3,
      });
    });
  });

  describe('getMappings (catálogos para armar el booking)', () => {
    const RAW = {
      isSuccess: true,
      message: 'ok',
      json: null,
      result: [
        { id: 1, tipo: 'Categorias', mapCode: 10, mapName: 'Suite' },
        { id: 2, tipo: 'RatePlan', mapCode: 20, mapName: 'Estandar' },
        { id: 3, tipo: 'Segmentos', mapCode: 30, mapName: 'Agencias' },
        { id: 4, tipo: 'Sub Segmentos', mapCode: 40, mapName: 'Mayorista' },
        { id: 5, tipo: 'Motivos', mapCode: 50, mapName: 'Vacaciones' },
        { id: 6, tipo: 'Canal de Venta', mapCode: 60, mapName: 'Booking' },
        { id: 7, tipo: 'Desconocido', mapCode: 70, mapName: 'No mapeado' },
      ],
    };

    it('clasifica los items por tipo y descarta los tipos desconocidos', async () => {
      mockAuthOk();
      mockedAxios.get.mockResolvedValueOnce({ data: RAW });

      const mappings = await service.getMappings('aixo');

      expect(mappings.categorias).toEqual([RAW.result[0]]);
      expect(mappings.ratePlans).toEqual([RAW.result[1]]);
      expect(mappings.segmentos).toEqual([RAW.result[2]]);
      expect(mappings.subSegmentos).toEqual([RAW.result[3]]);
      expect(mappings.motivos).toEqual([RAW.result[4]]);
      expect(mappings.canalesVenta).toEqual([RAW.result[5]]);
      // el item 'Desconocido' no aparece en ninguna lista
      const todos = Object.values(mappings).flat();
      expect(todos).toHaveLength(6);
    });

    it('cachea los mappings por slug (segunda llamada sin HTTP)', async () => {
      mockAuthOk();
      mockedAxios.get.mockResolvedValueOnce({ data: RAW });

      await service.getMappings('aixo');
      await service.getMappings('aixo');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolución de hoteles (slug ↔ autocoreId ↔ nombre)', () => {
    it('getHotelConfig devuelve la config del slug conocido', () => {
      const config = service.getHotelConfig('aixo');
      expect(config.name).toBe('Hotel Aixo');
      expect(config.autocoreId).toBe('13633');
    });

    it('findSlugByAutocoreId mapea id conocido y devuelve null si no existe', () => {
      expect(service.findSlugByAutocoreId('13633')).toBe('aixo');
      expect(service.findSlugByAutocoreId('99999')).toBeNull();
    });

    it('findSlugByHotelName acepta coincidencia exacta y parcial (case-insensitive)', () => {
      expect(service.findSlugByHotelName('Hotel Aixo')).toBe('aixo');
      expect(service.findSlugByHotelName('AIXO')).toBe('aixo');
      expect(service.findSlugByHotelName('Hotel Inexistente XYZ')).toBeNull();
    });
  });
});

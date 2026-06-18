import axios from 'axios';
import { MyToolBookingService } from './my-tool-booking.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('src/config', () => ({
  envs: {
    myToolEmail: 'test@mytool.com',
    myToolClave: 'secret',
  },
}));

jest.mock('src/config/constants/myToolBookingConstants', () => ({
  hotelMyToolConfig: {
    aixo: {
      ip: 'http://fake-aixo:59000',
      autocoreId: '13633',
      name: 'Hotel Aixo',
      city: 'Cartagena',
    },
  },
  MY_TOOL_ESTADO_CUENTA_PATH: 'EstadoCuenta/GetEstadoCuentaReserva',
  MY_TOOL_CANAL_VENTA_ID: 41,
  MY_TOOL_MAQUINA_ID: 1,
}));

describe('MyToolBookingService.getEstadoCuentaReserva', () => {
  let service: MyToolBookingService;

  beforeEach(() => {
    service = new MyToolBookingService();
    jest.clearAllMocks();
  });

  it('consulta POST autenticado y devuelve la respuesta', async () => {
    const estadoCuentaResponse = {
      isSuccess: true,
      message: 'Reservas consultadas correctamente.',
      json: null,
      result: [
        {
          reservaId: 14986,
          localizador: 'CB47476514',
          pagos: [
            {
              reservaId: 14986,
              fecha: '2026-06-06T22:55:40',
              formaPago: 'Cr. MasterCard',
              monto: 187425.0,
            },
          ],
        },
      ],
    };

    mockedAxios.post.mockResolvedValueOnce({
      data: { token: 'tok', valido: '2026-12-31' },
    });
    mockedAxios.post.mockResolvedValueOnce({ data: estadoCuentaResponse });

    const result = await service.getEstadoCuentaReserva(
      'aixo',
      'CB47476514',
      '2026-07-01',
      '2026-07-04',
    );

    expect(result).toEqual(estadoCuentaResponse);
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      'http://fake-aixo:59000/api/EstadoCuenta/GetEstadoCuentaReserva',
      {
        localizador: 'CB47476514',
        checkIn: '2026-07-01',
        checkOut: '2026-07-04',
      },
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok' },
      }),
    );
  });

  it('lanza si el hotel slug no existe', async () => {
    await expect(
      service.getEstadoCuentaReserva(
        'hotel-inexistente',
        'CB1',
        '2026-07-01',
        '2026-07-04',
      ),
    ).rejects.toThrow(
      "Hotel slug 'hotel-inexistente' no configurado en MyTool",
    );
  });
});

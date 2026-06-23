import { PuppeteerPoolService } from './puppeteer-pool.service';

describe('PuppeteerPoolService — browsers huérfanos', () => {
  let service: PuppeteerPoolService;

  beforeEach(() => {
    service = new PuppeteerPoolService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('cierra el browser incluso si page.pdf() lanza', async () => {
    const closeSpy = jest.fn();
    const pageStub = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockRejectedValue(new Error('PDF render crash')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browserStub = {
      newPage: jest.fn().mockResolvedValue(pageStub),
      close: closeSpy,
    };

    // Inyectar browser stub para saltar el launch real
    (service as any).browser = browserStub;

    await expect(service.generatePdf('<p>test</p>')).rejects.toThrow(
      'PDF render crash',
    );

    // El browser debe haberse cerrado (closeBrowser llamado en el catch)
    expect(closeSpy).toHaveBeenCalled();
    // Y la referencia interna queda en null (sin huérfano)
    expect((service as any).browser).toBeNull();
  });

  it('cierra la página aunque no haya error (try/finally de page.close)', async () => {
    const pageCloseSpy = jest.fn().mockResolvedValue(undefined);
    const pageStub = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
      close: pageCloseSpy,
    };
    const browserStub = {
      newPage: jest.fn().mockResolvedValue(pageStub),
      close: jest.fn(),
    };

    (service as any).browser = browserStub;

    const result = await service.generatePdf('<p>ok</p>');

    expect(result).toBeInstanceOf(Buffer);
    expect(pageCloseSpy).toHaveBeenCalled();
  });

  it('no deja browser huérfano si browser.close() también falla', async () => {
    const pageStub = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockRejectedValue(new Error('crash')),
      close: jest.fn().mockRejectedValue(new Error('TargetCloseError')),
    };
    const browserStub = {
      newPage: jest.fn().mockResolvedValue(pageStub),
      close: jest.fn().mockRejectedValue(new Error('browser already closed')),
    };

    (service as any).browser = browserStub;

    await expect(service.generatePdf('<p>boom</p>')).rejects.toThrow('crash');

    // Aunque browser.close() falló, la referencia queda null (finally en closeBrowser)
    expect((service as any).browser).toBeNull();
  });

  it('el semáforo se libera incluso tras fallo (no bloquea requests siguientes)', async () => {
    const pageStub = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockRejectedValue(new Error('fail')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browserStub = {
      newPage: jest.fn().mockResolvedValue(pageStub),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (service as any).browser = browserStub;

    // Primera llamada falla
    await expect(service.generatePdf('<p>1</p>')).rejects.toThrow('fail');

    // Inyectar de nuevo un browser (el anterior se cerró)
    const goodPageStub = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('ok')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const goodBrowserStub = {
      newPage: jest.fn().mockResolvedValue(goodPageStub),
      close: jest.fn(),
    };
    (service as any).browser = goodBrowserStub;

    // Segunda llamada debe funcionar (semáforo no se quedó bloqueado)
    const result = await service.generatePdf('<p>2</p>');
    expect(result).toBeInstanceOf(Buffer);
  });
});

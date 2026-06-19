import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

/**
 * Servicio para gestionar un pool de instancias de Puppeteer con control de concurrencia.
 * Mantiene una instancia única del navegador y limita las generaciones de PDF simultáneas.
 */
@Injectable()
export class PuppeteerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPoolService.name);
  private browser: puppeteer.Browser | null = null;
  private readonly MAX_CONCURRENT = 2; // Máximo de PDFs simultáneos
  private activeRequests = 0;
  private queue: Array<() => void> = [];

  async generatePdf(html: string): Promise<Buffer> {
    // Adquirir semáforo
    const releasePromise = this.acquireLock();
    let releaseLock: () => void = () => {};

    try {
      releaseLock = await releasePromise;

      // Asegurar que el navegador esté inicializado
      if (!this.browser) {
        await this.initializeBrowser();
      }

      // Crear página
      const page = await this.browser!.newPage();

      try {
        // Cargar contenido HTML
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // Generar PDF
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px',
          },
        });

        return Buffer.from(pdfBuffer);
      } catch (error) {
        // Si ocurre error, cerrar y nullificar el navegador
        this.logger.error('Error generando PDF, reciclando navegador', error);
        await this.closeBrowser();
        throw error;
      } finally {
        // Siempre cerrar la página
        await page.close();
      }
    } finally {
      // Liberar semáforo
      releaseLock();
      this.processQueue();
    }
  }

  /**
   * Inicializa el navegador con argumentos optimizados para entornos sin display.
   */
  private async initializeBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        executablePath:
          process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      this.logger.log('Navegador Puppeteer inicializado');
    } catch (error) {
      this.logger.error('Error inicializando navegador', error);
      throw error;
    }
  }

  /**
   * Cierra el navegador y lo nullifica.
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log('Navegador Puppeteer cerrado');
      } catch (error) {
        this.logger.error('Error cerrando navegador', error);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Adquiere un lock de semáforo. Devuelve una promesa que se resuelve
   * cuando el lock es adquirido, y su resultado es una función para liberar el lock.
   */
  private acquireLock(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.activeRequests < this.MAX_CONCURRENT) {
          this.activeRequests++;
          resolve(() => {
            this.activeRequests--;
          });
        } else {
          // Encolar intento
          this.queue.push(tryAcquire);
        }
      };

      tryAcquire();
    });
  }

  /**
   * Procesa la cola de requests pendientes.
   */
  private processQueue(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Hook de ciclo de vida para cerrar el navegador al destruir el módulo.
   */
  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }
}

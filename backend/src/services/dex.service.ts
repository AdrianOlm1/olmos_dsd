import prisma from '../config/db';
import logger from '../config/logger';

/**
 * DEX (Direct Exchange) EDI Service
 *
 * Generates UCS DEX 894 transaction sets for electronic invoice transfer
 * to major grocery retailers (Kroger, Publix, Albertsons, etc.)
 *
 * DEX 894 format is a subset of ANSI X12 EDI used specifically for
 * DSD invoice data exchange at the store receiving dock.
 */
export class DEXService {
  /**
   * Generate a DEX 894 transaction set for an invoice.
   * This data would be transmitted via DEX cable (serial/USB) to the retailer's
   * receiving system.
   */
  async generateDEX(invoiceId: string): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { include: { product: true } },
        customer: { include: { chain: true } },
        location: true,
        driver: { include: { user: true } },
      },
    });

    if (!invoice) throw new Error('Invoice not found');

    const chain = invoice.customer.chain;
    if (!chain?.dexSupported) {
      throw new Error(`Customer chain ${chain?.name || 'unknown'} does not support DEX`);
    }

    const locationCode = invoice.location?.dexLocationCode || '0000';
    const now = new Date();
    const dateStr = this.formatDate(now);
    const timeStr = this.formatTime(now);
    const controlNumber = invoice.invoiceNumber.replace(/\D/g, '').slice(-9).padStart(9, '0');

    let lineNumber = 1;
    const segments: string[] = [];

    // DXS - DEX Header
    segments.push(
      `DXS*${invoice.driverId.slice(0, 12)}*DX*004010UCS*1*${controlNumber}`
    );

    // ST - Transaction Set Header
    segments.push(`ST*894*${controlNumber}`);

    // G82 - Delivery/Return Base Record
    segments.push(
      `G82*D*${invoice.invoiceNumber}*${dateStr}*` +
      `${chain.code}*${locationCode}*` +
      `${invoice.driverId.slice(0, 12)}*D`
    );

    // G83 - Line item details
    for (const line of invoice.lines) {
      if (line.refused) continue;

      const upc = line.product.upc || line.product.sku;
      const qty = line.quantity.toNumber();
      const price = line.unitPrice.toNumber();

      segments.push(
        `G83*${lineNumber}*${qty}*EA*` +
        `*${upc}*UP*${price.toFixed(2)}`
      );

      lineNumber++;
    }

    // G84 - Total
    segments.push(
      `G84*${invoice.lines.filter(l => !l.refused).length}*` +
      `${invoice.totalAmount.toNumber().toFixed(2)}`
    );

    // G86 - Signature
    segments.push(
      `G86*${invoice.signedByName || 'RECEIVER'}*${dateStr}`
    );

    // G85 - Record Integrity Check (hash)
    const hashValue = this.calculateHash(segments.join(''));
    segments.push(`G85*${hashValue}`);

    // SE - Transaction Set Trailer
    const segmentCount = segments.length - 1; // Exclude DXS
    segments.push(`SE*${segmentCount}*${controlNumber}`);

    // DXE - DEX Trailer
    segments.push(`DXE*1*1`);

    const dexData = segments.join('\n');

    // Record the DEX transaction
    await prisma.dEXTransaction.create({
      data: {
        invoiceId,
        retailerCode: chain.code,
        locationCode,
        transmissionData: dexData,
        status: 'PENDING',
      },
    });

    return dexData;
  }

  /**
   * Mark a DEX transaction as transmitted
   */
  async markTransmitted(invoiceId: string) {
    await prisma.dEXTransaction.updateMany({
      where: { invoiceId, status: 'PENDING' },
      data: { status: 'TRANSMITTED', transmittedAt: new Date() },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { dexTransmitted: true, dexTransmittedAt: new Date() },
    });
  }

  /**
   * Mark a DEX transaction as acknowledged by the retailer
   */
  async markAcknowledged(invoiceId: string) {
    await prisma.dEXTransaction.updateMany({
      where: { invoiceId, status: 'TRANSMITTED' },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });
  }

  /**
   * Get all pending DEX transactions for a driver
   */
  async getPendingForDriver(driverId: string) {
    return prisma.dEXTransaction.findMany({
      where: {
        status: 'PENDING',
        invoice: { driverId } as any,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get supported DEX retailer chains
   */
  async getSupportedChains() {
    return prisma.chain.findMany({
      where: { dexSupported: true },
      orderBy: { name: 'asc' },
    });
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private calculateHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }
}

export const dexService = new DEXService();

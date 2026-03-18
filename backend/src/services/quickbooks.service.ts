import OAuthClient from 'intuit-oauth';
import prisma from '../config/db';
import { config } from '../config';
import logger from '../config/logger';
import { QBOSyncStatus } from '@prisma/client';

export class QuickBooksService {
  private oauthClient: OAuthClient;

  constructor() {
    this.oauthClient = new OAuthClient({
      clientId: config.qbo.clientId,
      clientSecret: config.qbo.clientSecret,
      environment: config.qbo.environment === 'production' ? 'production' : 'sandbox',
      redirectUri: config.qbo.redirectUri,
    });
  }

  // ─── OAuth Flow ───────────────────────────────────────────────

  getAuthUri(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: 'olmos-dsd-auth',
    });
  }

  async handleCallback(url: string) {
    const authResponse = await this.oauthClient.createToken(url);
    const token = authResponse.getJson();

    await prisma.qBOToken.upsert({
      where: { realmId: this.oauthClient.getToken().realmId },
      create: {
        realmId: this.oauthClient.getToken().realmId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        refreshExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
      },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        refreshExpiresAt: new Date(Date.now() + token.x_refresh_token_expires_in * 1000),
      },
    });

    return { realmId: this.oauthClient.getToken().realmId };
  }

  private async ensureAuthenticated(): Promise<{ realmId: string }> {
    const tokenRecord = await prisma.qBOToken.findFirst();
    if (!tokenRecord) throw new Error('QuickBooks not connected. Please authorize first.');

    this.oauthClient.setToken({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      token_type: tokenRecord.tokenType,
      expires_in: Math.floor((tokenRecord.expiresAt.getTime() - Date.now()) / 1000),
      x_refresh_token_expires_in: Math.floor((tokenRecord.refreshExpiresAt.getTime() - Date.now()) / 1000),
      realmId: tokenRecord.realmId,
    });

    // Refresh if expired
    if (this.oauthClient.isAccessTokenValid()) {
      return { realmId: tokenRecord.realmId };
    }

    try {
      const authResponse = await this.oauthClient.refresh();
      const newToken = authResponse.getJson();

      await prisma.qBOToken.update({
        where: { realmId: tokenRecord.realmId },
        data: {
          accessToken: newToken.access_token,
          refreshToken: newToken.refresh_token,
          expiresAt: new Date(Date.now() + newToken.expires_in * 1000),
          refreshExpiresAt: new Date(Date.now() + newToken.x_refresh_token_expires_in * 1000),
        },
      });

      return { realmId: tokenRecord.realmId };
    } catch (err) {
      logger.error('QBO token refresh failed', { error: err });
      throw new Error('QuickBooks token refresh failed. Please re-authorize.');
    }
  }

  private async makeApiCall(method: 'GET' | 'POST', endpoint: string, body?: any) {
    const { realmId } = await this.ensureAuthenticated();
    const baseUrl = config.qbo.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`;

    const response = await this.oauthClient.makeApiCall({
      url,
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    return JSON.parse(response.text());
  }

  // ─── Customer Sync ────────────────────────────────────────────

  async syncCustomerToQBO(customerId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');

    try {
      if (customer.qboCustomerId) {
        // Update existing
        const existing = await this.makeApiCall('GET', `customer/${customer.qboCustomerId}`);
        const result = await this.makeApiCall('POST', 'customer', {
          Id: customer.qboCustomerId,
          SyncToken: existing.Customer.SyncToken,
          DisplayName: customer.name,
          PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
          PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
        });
        return result.Customer;
      } else {
        // Create new
        const result = await this.makeApiCall('POST', 'customer', {
          DisplayName: customer.name,
          PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
          PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
        });

        await prisma.customer.update({
          where: { id: customerId },
          data: { qboCustomerId: String(result.Customer.Id) },
        });

        return result.Customer;
      }
    } catch (err) {
      logger.error('QBO customer sync failed', { customerId, error: err });
      throw err;
    }
  }

  // ─── Invoice Sync ─────────────────────────────────────────────

  async syncInvoiceToQBO(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
    });
    if (!invoice) throw new Error('Invoice not found');

    // Ensure customer exists in QBO
    if (!invoice.customer.qboCustomerId) {
      await this.syncCustomerToQBO(invoice.customerId);
      const updatedCustomer = await prisma.customer.findUnique({ where: { id: invoice.customerId } });
      if (!updatedCustomer?.qboCustomerId) throw new Error('Could not sync customer to QBO');
    }

    const customer = await prisma.customer.findUnique({ where: { id: invoice.customerId } });

    try {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { qboSyncStatus: 'SYNCING' },
      });

      // Ensure products exist in QBO
      for (const line of invoice.lines) {
        if (!line.product.qboItemId) {
          await this.syncProductToQBO(line.productId);
        }
      }

      // Reload products with QBO IDs
      const freshLines = await prisma.invoiceLine.findMany({
        where: { invoiceId },
        include: { product: true },
      });

      const qboInvoice: any = {
        CustomerRef: { value: customer!.qboCustomerId },
        TxnDate: invoice.createdAt.toISOString().split('T')[0],
        DocNumber: invoice.invoiceNumber,
        Line: freshLines.map(line => ({
          DetailType: 'SalesItemLineDetail',
          Amount: line.lineTotal.toNumber(),
          SalesItemLineDetail: {
            ItemRef: { value: line.product.qboItemId },
            Qty: line.quantity.toNumber(),
            UnitPrice: line.unitPrice.toNumber(),
          },
        })),
      };

      if (invoice.qboInvoiceId) {
        const existing = await this.makeApiCall('GET', `invoice/${invoice.qboInvoiceId}`);
        qboInvoice.Id = invoice.qboInvoiceId;
        qboInvoice.SyncToken = existing.Invoice.SyncToken;
      }

      const result = await this.makeApiCall('POST', 'invoice', qboInvoice);

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          qboInvoiceId: String(result.Invoice.Id),
          qboSyncStatus: 'SYNCED',
          qboSyncedAt: new Date(),
          qboSyncError: null,
        },
      });

      await prisma.syncLog.create({
        data: {
          direction: 'SERVER_TO_QBO',
          entityType: 'invoice',
          entityId: invoiceId,
          status: 'SUCCESS',
        },
      });

      return result.Invoice;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown QBO error';
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { qboSyncStatus: 'ERROR', qboSyncError: errorMsg },
      });

      await prisma.syncLog.create({
        data: {
          direction: 'SERVER_TO_QBO',
          entityType: 'invoice',
          entityId: invoiceId,
          status: 'FAILED',
          errorMessage: errorMsg,
        },
      });

      logger.error('QBO invoice sync failed', { invoiceId, error: errorMsg });
      throw err;
    }
  }

  // ─── Product Sync ─────────────────────────────────────────────

  async syncProductToQBO(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Product not found');

    try {
      if (product.qboItemId) {
        const existing = await this.makeApiCall('GET', `item/${product.qboItemId}`);
        const result = await this.makeApiCall('POST', 'item', {
          Id: product.qboItemId,
          SyncToken: existing.Item.SyncToken,
          Name: product.name,
          Sku: product.sku,
          UnitPrice: product.basePrice.toNumber(),
          Type: 'Inventory',
        });
        return result.Item;
      } else {
        // Need IncomeAccountRef and AssetAccountRef for inventory items
        const result = await this.makeApiCall('POST', 'item', {
          Name: product.name,
          Sku: product.sku,
          UnitPrice: product.basePrice.toNumber(),
          Type: 'NonInventory', // Use NonInventory since we track inventory ourselves
          IncomeAccountRef: { value: '1' }, // Sales of Product Income - configure per setup
        });

        await prisma.product.update({
          where: { id: productId },
          data: { qboItemId: String(result.Item.Id) },
        });

        return result.Item;
      }
    } catch (err) {
      logger.error('QBO product sync failed', { productId, error: err });
      throw err;
    }
  }

  // ─── Payment Sync ─────────────────────────────────────────────

  async syncPaymentToQBO(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { include: { customer: true } } },
    });
    if (!payment) throw new Error('Payment not found');

    const customer = payment.invoice.customer;
    if (!customer.qboCustomerId) {
      await this.syncCustomerToQBO(customer.id);
    }
    if (!payment.invoice.qboInvoiceId) {
      await this.syncInvoiceToQBO(payment.invoiceId);
    }

    const freshInvoice = await prisma.invoice.findUnique({ where: { id: payment.invoiceId } });
    const freshCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });

    try {
      const result = await this.makeApiCall('POST', 'payment', {
        CustomerRef: { value: freshCustomer!.qboCustomerId },
        TotalAmt: payment.amount.toNumber(),
        Line: [{
          Amount: payment.amount.toNumber(),
          LinkedTxn: [{
            TxnId: freshInvoice!.qboInvoiceId,
            TxnType: 'Invoice',
          }],
        }],
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          qboPaymentId: String(result.Payment.Id),
          qboSyncStatus: 'SYNCED',
        },
      });

      return result.Payment;
    } catch (err) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { qboSyncStatus: 'ERROR' },
      });
      logger.error('QBO payment sync failed', { paymentId, error: err });
      throw err;
    }
  }

  // ─── Sync Status ──────────────────────────────────────────────

  async getSyncStatus() {
    const [pendingInvoices, errorInvoices, pendingPayments, errorPayments, pendingCredits] = await Promise.all([
      prisma.invoice.count({ where: { qboSyncStatus: 'PENDING' } }),
      prisma.invoice.count({ where: { qboSyncStatus: 'ERROR' } }),
      prisma.payment.count({ where: { qboSyncStatus: 'PENDING' } }),
      prisma.payment.count({ where: { qboSyncStatus: 'ERROR' } }),
      prisma.creditMemo.count({ where: { qboSyncStatus: 'PENDING' } }),
    ]);

    return {
      invoices: { pending: pendingInvoices, errors: errorInvoices },
      payments: { pending: pendingPayments, errors: errorPayments },
      credits: { pending: pendingCredits },
    };
  }

  async getConnectionStatus() {
    const token = await prisma.qBOToken.findFirst();
    if (!token) return { connected: false };

    return {
      connected: true,
      realmId: token.realmId,
      tokenExpiresAt: token.expiresAt,
      isExpired: token.expiresAt < new Date(),
    };
  }
}

export const quickbooksService = new QuickBooksService();

import prisma from '../config/db';
import { Decimal } from '@prisma/client/runtime/library';

interface PriceResult {
  unitPrice: number;
  source: 'customer' | 'chain' | 'level' | 'base';
  promotionId?: string;
  promotionDiscount?: number;
  promotionDescription?: string;
  effectivePrice: number;
}

export class PricingService {
  /**
   * Resolves the best price for a product for a given customer.
   * Priority: Customer-specific > Chain-level > Price Level > Base price
   * Then applies any active promotions on top.
   */
  async resolvePrice(
    productId: string,
    customerId: string,
    quantity: number,
    date: Date = new Date()
  ): Promise<PriceResult> {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error(`Product ${productId} not found`);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { chain: true },
    });
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    let unitPrice = product.basePrice.toNumber();
    let source: PriceResult['source'] = 'base';

    // 1. Check customer-specific price
    const customerPrice = await prisma.customerPriceLevel.findFirst({
      where: {
        customerId,
        productId,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (customerPrice) {
      unitPrice = customerPrice.price.toNumber();
      source = 'customer';
    } else if (customer.chainId) {
      // 2. Check chain-level price
      const chainPrice = await prisma.chainPriceLevel.findFirst({
        where: {
          chainId: customer.chainId,
          productId,
          isActive: true,
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (chainPrice) {
        unitPrice = chainPrice.price.toNumber();
        source = 'chain';
      }
    }

    // 3. Check quantity-based price levels (if no customer/chain price found)
    if (source === 'base') {
      const priceLevel = await prisma.priceLevel.findFirst({
        where: {
          productId,
          isActive: true,
          minQuantity: { lte: quantity },
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
        orderBy: [{ minQuantity: 'desc' }, { effectiveFrom: 'desc' }],
      });

      if (priceLevel) {
        unitPrice = priceLevel.price.toNumber();
        source = 'level';
      }
    }

    // 4. Check for active promotions
    const result: PriceResult = { unitPrice, source, effectivePrice: unitPrice };

    const activePromotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
        ...(customer.chainId ? { OR: [{ chainId: customer.chainId }, { chainId: null }] } : { chainId: null }),
        items: { some: { productId, isBuyItem: true } },
      },
      include: { items: true },
    });

    for (const promo of activePromotions) {
      switch (promo.type) {
        case 'PERCENTAGE_OFF':
          if (promo.discountValue) {
            const discount = unitPrice * (promo.discountValue.toNumber() / 100);
            result.promotionId = promo.id;
            result.promotionDiscount = discount;
            result.promotionDescription = promo.name;
            result.effectivePrice = unitPrice - discount;
          }
          break;

        case 'FIXED_AMOUNT_OFF':
          if (promo.discountValue) {
            const discount = promo.discountValue.toNumber();
            result.promotionId = promo.id;
            result.promotionDiscount = discount;
            result.promotionDescription = promo.name;
            result.effectivePrice = Math.max(0, unitPrice - discount);
          }
          break;

        case 'TEMPORARY_PRICE_REDUCTION':
          if (promo.discountValue) {
            const tprPrice = promo.discountValue.toNumber();
            if (tprPrice < unitPrice) {
              result.promotionId = promo.id;
              result.promotionDiscount = unitPrice - tprPrice;
              result.promotionDescription = promo.name;
              result.effectivePrice = tprPrice;
            }
          }
          break;

        case 'BOGO':
          if (promo.buyQuantity && promo.getQuantity && quantity >= promo.buyQuantity) {
            const freeItems = Math.floor(quantity / promo.buyQuantity) * promo.getQuantity;
            const totalItems = quantity + freeItems;
            const effectiveUnitPrice = (unitPrice * quantity) / totalItems;
            result.promotionId = promo.id;
            result.promotionDiscount = unitPrice - effectiveUnitPrice;
            result.promotionDescription = `${promo.name} (Buy ${promo.buyQuantity} Get ${promo.getQuantity})`;
            result.effectivePrice = effectiveUnitPrice;
          }
          break;
      }
    }

    return result;
  }

  /**
   * Bulk resolve prices for multiple products for a customer (for loading catalog)
   */
  async resolveBulkPrices(productIds: string[], customerId: string): Promise<Map<string, PriceResult>> {
    const results = new Map<string, PriceResult>();
    // Process in batches of 50 for performance
    const batchSize = 50;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const promises = batch.map(pid => this.resolvePrice(pid, customerId, 1));
      const batchResults = await Promise.all(promises);
      batch.forEach((pid, idx) => results.set(pid, batchResults[idx]));
    }
    return results;
  }
}

export const pricingService = new PricingService();

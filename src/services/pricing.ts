import { Prisma } from '../generated/prisma/index.js';
import { HttpError } from '../middleware/http.js';
export interface RequestedLine { productId: number; size: string; quantity: number }
export async function priceLines(tx: Prisma.TransactionClient, lines: RequestedLine[]) {
  const products = await tx.product.findMany({ where: { id: { in: [...new Set(lines.map(l => l.productId))] } }, include: { campaign: true } });
  const quantities = new Map<number, number>();
  const quoted = lines.map(line => {
    const product = products.find(p => p.id === line.productId);
    if (!product) throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'Sepetinizdeki bir ürün artık mevcut değil.');
    if (!product.sizes.includes(line.size)) throw new HttpError(400, 'INVALID_SIZE', 'Seçilen beden bu üründe mevcut değil.');
    const amount = (quantities.get(product.id) ?? 0) + line.quantity;
    quantities.set(product.id, amount);
    if (amount > product.total_qty) throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Seçilen ürün için yeterli stok yok.');
    const discount = product.campaign?.discount ?? 0;
    if (discount < 0 || discount > 100) throw new HttpError(409, 'INVALID_CAMPAIGN', 'Ürün kampanyası şu anda kullanılamıyor.');
    const price = new Prisma.Decimal(product.price).mul(100 - discount).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { productId: product.id, name: product.name, size: line.size, quantity: line.quantity, image: product.images[0] ?? '', price };
  });
  const subtotal = quoted.reduce((sum, line) => sum.add(line.price.mul(line.quantity)), new Prisma.Decimal(0));
  if (subtotal.greaterThan('99999999.99')) throw new HttpError(400, 'CART_LIMIT', 'Sepet tutarı izin verilen sınırı aşıyor.');
  return { quoted, subtotal };
}

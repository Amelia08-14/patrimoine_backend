import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Une seule commande en cours de validation à la fois par client, tous types confondus (pack de
// points OU abonnement boutique) — demande client du 25/10/2026. L'erreur porte la date et le
// montant de la commande en attente pour que le front affiche "vous avez déjà une commande en
// cours de validation du JJ/MM/AAAA, de X DA" dans la langue du client (code ORDER_PENDING).
export async function assertNoPendingOrder(prisma: PrismaService, userId: number) {
  const [points, boutique] = await Promise.all([
    prisma.pointPurchase.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, select: { id: true, price: true, createdAt: true } }),
    prisma.boutiqueSubscription.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, select: { id: true, price: true, createdAt: true } }),
  ]);
  const pending = points ? { kind: 'POINTS' as const, ...points } : boutique ? { kind: 'BOUTIQUE' as const, ...boutique } : null;
  if (!pending) return;
  const date = new Date(pending.createdAt).toLocaleDateString('fr-FR');
  throw new BadRequestException({
    statusCode: 400,
    code: 'ORDER_PENDING',
    kind: pending.kind,
    orderId: pending.id,
    price: pending.price,
    createdAt: pending.createdAt,
    message: `Vous avez déjà une commande en cours de validation (du ${date}, ${pending.price.toLocaleString('fr-FR')} DA). Attendez sa validation avant d'en passer une nouvelle.`,
  });
}

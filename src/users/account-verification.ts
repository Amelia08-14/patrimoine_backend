import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Un compte non validé par l'admin (nouveau compte, ou profil modifié en attente de revalidation —
// cf. PUT /users/profile) ne peut rien publier : dépôt/modification d'annonce, recherche confiée,
// actualisation, mise en avant. Les admins ne sont jamais bloqués.
export async function assertAccountVerified(prisma: PrismaService, userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { adminVerified: true, userType: true } });
  if (!user) throw new ForbiddenException('Compte introuvable.');
  if (user.userType === 'ADMIN' || user.adminVerified) return;
  throw new ForbiddenException({
    statusCode: 403,
    code: 'ACCOUNT_PENDING_VALIDATION',
    message: "Votre compte est en attente de validation par un administrateur. Vous ne pouvez pas publier ni modifier de contenu tant qu'il n'est pas validé.",
  });
}

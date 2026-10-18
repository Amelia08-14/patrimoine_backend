-- CreateTable
-- Aucune migration précédente ne créait ces deux tables (elles avaient été introduites via
-- `prisma db push` sur certains postes, jamais suivies par une migration) — corrigé le 18/10/2026
-- après un rebuild de base locale qui a révélé le trou (P3018 "point_purchase doesn't exist").
CREATE TABLE `point_purchase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pack` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `price` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validatedAt` DATETIME(3) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `boutique_subscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pack` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `pointsIncluded` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validatedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `point_purchase` ADD CONSTRAINT `point_purchase_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `boutique_subscription` ADD CONSTRAINT `boutique_subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

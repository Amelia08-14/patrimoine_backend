-- CreateTable
CREATE TABLE `offer_pack` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('POINTS', 'BOUTIQUE') NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `points` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `offer_pack_kind_key_key`(`kind`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed : valeurs actuellement codées en dur (points.service.ts / boutique-sub.service.ts),
-- reprises telles quelles pour ne rien changer au comportement existant à l'application
-- de cette migration. Idempotent (ON DUPLICATE KEY : ne réécrase pas des valeurs déjà éditées).
INSERT INTO `offer_pack` (`kind`, `key`, `title`, `description`, `price`, `points`, `order`, `updatedAt`) VALUES
    ('POINTS', 'PACK_50', 'Starter', NULL, 1500, 50, 0, CURRENT_TIMESTAMP(3)),
    ('POINTS', 'PACK_100', 'Pro', NULL, 2500, 100, 1, CURRENT_TIMESTAMP(3)),
    ('POINTS', 'PACK_200', 'Premium', NULL, 3500, 200, 2, CURRENT_TIMESTAMP(3)),
    ('BOUTIQUE', 'STANDARD', 'Boutique Standard', NULL, 5000, 50, 0, CURRENT_TIMESTAMP(3)),
    ('BOUTIQUE', 'AVANCEE', 'Boutique Avancée', NULL, 10000, 100, 1, CURRENT_TIMESTAMP(3)),
    ('BOUTIQUE', 'ENTREPRISE', 'Boutique Entreprise', NULL, 15000, 200, 2, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `key` = `key`;

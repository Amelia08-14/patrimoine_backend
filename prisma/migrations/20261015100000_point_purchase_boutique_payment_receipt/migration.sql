-- AlterTable
ALTER TABLE `point_purchase` ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `receiptUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `boutique_subscription` ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `receiptUrl` VARCHAR(191) NULL;

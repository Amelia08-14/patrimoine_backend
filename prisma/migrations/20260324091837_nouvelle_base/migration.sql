/*
  Warnings:

  - You are about to drop the column `description` on the `property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `announce` ADD COLUMN `priceType` VARCHAR(191) NULL,
    ADD COLUMN `priceUnit` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `property` DROP COLUMN `description`,
    ADD COLUMN `commune` VARCHAR(191) NULL,
    ADD COLUMN `contacts` VARCHAR(191) NULL,
    ADD COLUMN `mapsLink` VARCHAR(191) NULL,
    ADD COLUMN `videos` VARCHAR(191) NULL;

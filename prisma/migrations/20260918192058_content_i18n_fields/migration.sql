-- AlterTable
ALTER TABLE `faq_item` ADD COLUMN `answerAr` TEXT NULL,
    ADD COLUMN `answerEn` TEXT NULL,
    ADD COLUMN `questionAr` TEXT NULL,
    ADD COLUMN `questionEn` TEXT NULL;

-- AlterTable
ALTER TABLE `hero_slide` ADD COLUMN `link` VARCHAR(191) NULL,
    ADD COLUMN `subtitleAr` VARCHAR(191) NULL,
    ADD COLUMN `subtitleEn` VARCHAR(191) NULL,
    ADD COLUMN `titleAr` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `legal_section` ADD COLUMN `bodyAr` TEXT NULL,
    ADD COLUMN `bodyEn` TEXT NULL,
    ADD COLUMN `titleAr` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `offer_pack` ADD COLUMN `descriptionAr` TEXT NULL,
    ADD COLUMN `descriptionEn` TEXT NULL,
    ADD COLUMN `titleAr` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `useful_link` ADD COLUMN `titleAr` VARCHAR(191) NULL,
    ADD COLUMN `titleEn` VARCHAR(191) NULL;


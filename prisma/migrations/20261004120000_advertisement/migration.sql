-- CreateTable
CREATE TABLE `advertisement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `titleAr` VARCHAR(191) NULL,
    `titleEn` VARCHAR(191) NULL,
    `subtitle` VARCHAR(191) NULL,
    `subtitleAr` VARCHAR(191) NULL,
    `subtitleEn` VARCHAR(191) NULL,
    `buttonLabel` VARCHAR(191) NULL,
    `buttonLabelAr` VARCHAR(191) NULL,
    `buttonLabelEn` VARCHAR(191) NULL,
    `placements` VARCHAR(191) NOT NULL DEFAULT 'SIDEBAR,STRIP,BANNER',
    `pages` VARCHAR(191) NOT NULL DEFAULT 'HOME,ANNOUNCES,DEMANDES',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `views` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

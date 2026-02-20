-- DropForeignKey
ALTER TABLE `announce` DROP FOREIGN KEY `announce_userId_fkey`;

-- DropForeignKey
ALTER TABLE `point_usage` DROP FOREIGN KEY `point_usage_announceId_fkey`;

-- DropForeignKey
ALTER TABLE `point_usage` DROP FOREIGN KEY `point_usage_userId_fkey`;

-- DropForeignKey
ALTER TABLE `user_point` DROP FOREIGN KEY `user_point_userId_fkey`;

-- AlterTable
ALTER TABLE `announce` MODIFY `status` ENUM('DRAFT', 'WAITING_VALIDATION', 'VALIDATED', 'ARCHIVED', 'REJECTED') NOT NULL;

-- AlterTable
ALTER TABLE `property` ADD COLUMN `amenities` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `userType` ENUM('PARTICULIER', 'SOCIETE', 'ADMIN') NOT NULL DEFAULT 'PARTICULIER';

-- CreateTable
CREATE TABLE `favorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `announceId` INTEGER NOT NULL,

    UNIQUE INDEX `favorite_userId_announceId_key`(`userId`, `announceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `senderId` INTEGER NOT NULL,
    `receiverId` INTEGER NOT NULL,
    `announceId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NULL DEFAULT 'NEW',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entrusted_research` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction` ENUM('RENTAL', 'SALE', 'HOLIDAY_RENTAL') NOT NULL,
    `minSurface` DOUBLE NULL,
    `maxSurface` DOUBLE NULL,
    `nbPieces` INTEGER NULL,
    `nbRooms` INTEGER NULL,
    `nbFloors` INTEGER NULL,
    `minBudget` DOUBLE NOT NULL,
    `maxBudget` DOUBLE NOT NULL,
    `installationDate` DATETIME(3) NOT NULL,
    `cityId` INTEGER NULL,
    `towns` VARCHAR(191) NULL,
    `comment` TEXT NOT NULL,
    `userId` INTEGER NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `activity` VARCHAR(191) NULL,
    `realEstateType` VARCHAR(191) NULL,
    `propertyType` VARCHAR(191) NULL,
    `amenities` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_point` ADD CONSTRAINT `user_point_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_usage` ADD CONSTRAINT `point_usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_usage` ADD CONSTRAINT `point_usage_announceId_fkey` FOREIGN KEY (`announceId`) REFERENCES `announce`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announce` ADD CONSTRAINT `announce_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_announceId_fkey` FOREIGN KEY (`announceId`) REFERENCES `announce`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_announceId_fkey` FOREIGN KEY (`announceId`) REFERENCES `announce`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entrusted_research` ADD CONSTRAINT `entrusted_research_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

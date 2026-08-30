-- CreateTable
CREATE TABLE `announce_view` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `announceId` INTEGER NOT NULL,
    `ownerId` INTEGER NOT NULL,

    INDEX `announce_view_ownerId_createdAt_idx`(`ownerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `announce_view` ADD CONSTRAINT `announce_view_announceId_fkey` FOREIGN KEY (`announceId`) REFERENCES `announce`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announce_view` ADD CONSTRAINT `announce_view_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

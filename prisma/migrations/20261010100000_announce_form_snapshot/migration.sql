-- CreateTable
CREATE TABLE `announce_form_snapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `announceId` INTEGER NOT NULL,
    `data` LONGTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `announce_form_snapshot_announceId_key`(`announceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `announce_form_snapshot` ADD CONSTRAINT `announce_form_snapshot_announceId_fkey` FOREIGN KEY (`announceId`) REFERENCES `announce`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

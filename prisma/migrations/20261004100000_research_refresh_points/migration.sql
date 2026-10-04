-- AlterTable
ALTER TABLE `entrusted_research` ADD COLUMN `refreshDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `point_usage` MODIFY `announceId` INTEGER NULL,
    ADD COLUMN `researchId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `point_usage` ADD CONSTRAINT `point_usage_researchId_fkey` FOREIGN KEY (`researchId`) REFERENCES `entrusted_research`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

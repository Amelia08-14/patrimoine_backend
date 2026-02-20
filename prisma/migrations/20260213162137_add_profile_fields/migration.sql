-- AlterTable
ALTER TABLE `user` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `adminVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `agreementDocumentUrl` VARCHAR(191) NULL,
    ADD COLUMN `civility` ENUM('M', 'MME') NULL,
    ADD COLUMN `dateOfBirth` DATETIME(3) NULL,
    ADD COLUMN `landline` VARCHAR(191) NULL,
    ADD COLUMN `rcDocumentUrl` VARCHAR(191) NULL;

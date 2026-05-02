-- Adds sale-related fields for Property (Villa/Immeuble/etc.)
ALTER TABLE `property`
  ADD COLUMN `facadesCount` INT NULL,
  ADD COLUMN `acceptsBankCredit` VARCHAR(32) NULL,
  ADD COLUMN `legalDocuments` TEXT NULL;


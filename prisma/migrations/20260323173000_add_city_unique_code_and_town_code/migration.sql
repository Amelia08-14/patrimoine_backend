ALTER TABLE `city`
  ADD UNIQUE INDEX `city_code_key` (`code`);

ALTER TABLE `town`
  ADD COLUMN `code` INT NULL;

ALTER TABLE `town`
  ADD UNIQUE INDEX `town_code_key` (`code`);


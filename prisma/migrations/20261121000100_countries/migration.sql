-- Country → province/state/jurisdiction → official lottery organism.

-- CreateTable
CREATE TABLE `Country` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(2) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Country_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Country` (`id`, `code`, `name`) VALUES ('country_ar', 'AR', 'Argentina'), ('country_uy', 'UY', 'Uruguay');

-- Existing rows: everything is Argentina except the Montevideo lottery.
ALTER TABLE `Province` ADD COLUMN `countryId` VARCHAR(191) NOT NULL DEFAULT 'country_ar';
ALTER TABLE `Lottery` ADD COLUMN `countryId` VARCHAR(191) NOT NULL DEFAULT 'country_ar';
ALTER TABLE `ContentIdea` ADD COLUMN `countryId` VARCHAR(191) NOT NULL DEFAULT 'country_ar';
UPDATE `Lottery` SET `countryId` = 'country_uy' WHERE `code` = 'MONTEVIDEO';
ALTER TABLE `Province` ALTER COLUMN `countryId` DROP DEFAULT;
ALTER TABLE `Lottery` ALTER COLUMN `countryId` DROP DEFAULT;
ALTER TABLE `ContentIdea` ALTER COLUMN `countryId` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `Province` ADD CONSTRAINT `Province_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Lottery` ADD CONSTRAINT `Lottery_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ContentIdea` ADD CONSTRAINT `ContentIdea_countryId_fkey` FOREIGN KEY (`countryId`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

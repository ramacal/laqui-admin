-- AlterTable
ALTER TABLE `Lottery` ADD COLUMN `brandPrimaryColor` VARCHAR(9) NULL,
    ADD COLUMN `brandSecondaryColor` VARCHAR(9) NULL,
    ADD COLUMN `fullName` VARCHAR(191) NULL,
    ADD COLUMN `logoKey` VARCHAR(500) NULL,
    ADD COLUMN `provinceId` VARCHAR(191) NULL,
    ADD COLUMN `quinielaDraws` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `website` VARCHAR(300) NULL;

-- AlterTable
ALTER TABLE `Province` DROP COLUMN `brandPrimaryColor`,
    DROP COLUMN `brandSecondaryColor`,
    DROP COLUMN `logoKey`;

-- CreateIndex
CREATE UNIQUE INDEX `Lottery_provinceId_key` ON `Lottery`(`provinceId`);

-- AddForeignKey
ALTER TABLE `Lottery` ADD CONSTRAINT `Lottery_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- The Quiniela lotteries Laqui already offered keep being offered.
UPDATE `Lottery` SET `quinielaDraws` = true WHERE `code` IN ('CIUDAD', 'PROVINCIA', 'SANTA_FE', 'CORDOBA', 'ENTRE_RIOS', 'MENDOZA', 'MONTEVIDEO');

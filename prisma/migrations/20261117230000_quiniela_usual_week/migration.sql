-- Quiniela schedule as a usual week (valid from/until) plus date exceptions and draw-number
-- anchors, instead of a day-by-day copy of every month. Orders point at (date, slot).
-- The day-by-day tables are dropped; a month's official program is applied again by
-- re-publishing it (published programs go back to draft below).
-- DropForeignKey
ALTER TABLE `OrderQuinielaDraw` DROP FOREIGN KEY `OrderQuinielaDraw_drawId_fkey`;

-- DropForeignKey
ALTER TABLE `ProvinceQuinielaDrawLottery` DROP FOREIGN KEY `ProvinceQuinielaDrawLottery_drawId_fkey`;

-- DropForeignKey
ALTER TABLE `ProvinceQuinielaDrawLottery` DROP FOREIGN KEY `ProvinceQuinielaDrawLottery_lotteryId_fkey`;

-- DropForeignKey
ALTER TABLE `ProvinceQuinielaProgramDay` DROP FOREIGN KEY `ProvinceQuinielaProgramDay_programId_fkey`;

-- DropForeignKey
ALTER TABLE `ProvinceQuinielaProgramDayDraw` DROP FOREIGN KEY `ProvinceQuinielaProgramDayDraw_dayId_fkey`;

-- DropIndex
DROP INDEX `OrderQuinielaDraw_drawId_fkey` ON `OrderQuinielaDraw`;

-- AlterTable
ALTER TABLE `OrderQuinielaDraw` DROP PRIMARY KEY,
    DROP COLUMN `drawId`,
    ADD COLUMN `date` DATE NOT NULL,
    ADD COLUMN `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    ADD PRIMARY KEY (`orderId`, `date`, `slot`);

-- AlterTable
ALTER TABLE `ProvinceGameAvailability` ADD COLUMN `prizeExpiryDays` INTEGER NULL;

-- DropTable
DROP TABLE `ProvinceQuinielaDrawLottery`;

-- DropTable
DROP TABLE `ProvinceQuinielaProgramDay`;

-- DropTable
DROP TABLE `ProvinceQuinielaProgramDayDraw`;

-- CreateTable
CREATE TABLE `ProvinceQuinielaDrawRule` (
    `id` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `drawTime` TIME(0) NOT NULL,
    `validFrom` DATE NOT NULL,
    `validTo` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProvinceQuinielaDrawRule_provinceId_slot_lotteryId_weekday_idx`(`provinceId`, `slot`, `lotteryId`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceQuinielaException` (
    `id` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `action` ENUM('SKIP', 'ADD', 'TIME', 'PRIZE_EXPIRY') NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NULL,
    `lotteryId` VARCHAR(191) NULL,
    `drawTime` TIME(0) NULL,
    `prizeExpiry` DATE NULL,
    `note` VARCHAR(191) NULL,
    `source` ENUM('PROGRAM', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `programId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProvinceQuinielaException_provinceId_date_idx`(`provinceId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceQuinielaDrawNumber` (
    `provinceId` VARCHAR(191) NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `number` INTEGER NOT NULL,
    `source` ENUM('PROGRAM', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `programId` VARCHAR(191) NULL,

    PRIMARY KEY (`provinceId`, `slot`, `lotteryId`, `date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawRule` ADD CONSTRAINT `ProvinceQuinielaDrawRule_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawRule` ADD CONSTRAINT `ProvinceQuinielaDrawRule_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaException` ADD CONSTRAINT `ProvinceQuinielaException_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaException` ADD CONSTRAINT `ProvinceQuinielaException_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaException` ADD CONSTRAINT `ProvinceQuinielaException_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ProvinceQuinielaMonthlyProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawNumber` ADD CONSTRAINT `ProvinceQuinielaDrawNumber_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawNumber` ADD CONSTRAINT `ProvinceQuinielaDrawNumber_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawNumber` ADD CONSTRAINT `ProvinceQuinielaDrawNumber_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ProvinceQuinielaMonthlyProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Shape checks.
ALTER TABLE `ProvinceQuinielaDrawRule` ADD CONSTRAINT `ProvinceQuinielaDrawRule_weekday_check` CHECK (`weekday` BETWEEN 0 AND 6),
    ADD CONSTRAINT `ProvinceQuinielaDrawRule_valid_check` CHECK (`validTo` IS NULL OR `validTo` >= `validFrom`);
ALTER TABLE `ProvinceQuinielaException` ADD CONSTRAINT `ProvinceQuinielaException_shape_check` CHECK (
    (`action` = 'SKIP' AND (`lotteryId` IS NULL OR `slot` IS NOT NULL))
    OR (`action` = 'ADD' AND `slot` IS NOT NULL AND `lotteryId` IS NOT NULL AND `drawTime` IS NOT NULL)
    OR (`action` = 'TIME' AND `slot` IS NOT NULL AND `lotteryId` IS NULL AND `drawTime` IS NOT NULL)
    OR (`action` = 'PRIZE_EXPIRY' AND `slot` IS NULL AND `lotteryId` IS NULL AND `prizeExpiry` IS NOT NULL)
);

-- Lotería de la Provincia: prizes expire 10 days after the draw (next business day).
UPDATE `ProvinceGameAvailability` pga
    JOIN `Province` p ON p.`id` = pga.`provinceId`
    JOIN `GameDefinition` g ON g.`id` = pga.`gameId`
SET pga.`prizeExpiryDays` = 10
WHERE p.`code` = 'B' AND g.`code` = 'QUINIELA';

-- Published programs were applied as day-by-day copies: back to draft to apply them again.
UPDATE `ProvinceQuinielaMonthlyProgram` SET `status` = 'DRAFT', `publishedAt` = NULL WHERE `status` = 'PUBLISHED';

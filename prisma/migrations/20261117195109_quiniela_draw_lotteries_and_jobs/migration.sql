-- Quiniela draws know which lotteries take part (with their official draw number), monthly
-- programs keep their source PDF and checks, province bet rules, and scheduled jobs.

-- AlterTable
ALTER TABLE `ProvinceGameAvailability` ADD COLUMN `cutoffMinutes` INTEGER NULL,
    ADD COLUMN `maxBetAmount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `ProvinceQuinielaMonthlyProgram` ADD COLUMN `sourceHash` VARCHAR(64) NULL,
    ADD COLUMN `sourceUrl` VARCHAR(500) NULL,
    ADD COLUMN `warnings` JSON NULL;

-- AlterTable
ALTER TABLE `ProvinceQuinielaProgramDay` ADD COLUMN `prizeExpiry` DATE NULL;

-- CreateTable
CREATE TABLE `ProvinceQuinielaDrawLottery` (
    `drawId` VARCHAR(191) NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `drawNumber` INTEGER NULL,

    PRIMARY KEY (`drawId`, `lotteryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledJob` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `lastStatus` ENUM('RUNNING', 'OK', 'WARNING', 'ERROR') NULL,
    `nextRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScheduledJob_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobRun` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `trigger` ENUM('SCHEDULE', 'MANUAL') NOT NULL,
    `status` ENUM('RUNNING', 'OK', 'WARNING', 'ERROR') NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `details` JSON NULL,
    `error` TEXT NULL,
    `triggeredById` VARCHAR(191) NULL,

    INDEX `JobRun_jobId_startedAt_idx`(`jobId`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawLottery` ADD CONSTRAINT `ProvinceQuinielaDrawLottery_drawId_fkey` FOREIGN KEY (`drawId`) REFERENCES `ProvinceQuinielaProgramDayDraw`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaDrawLottery` ADD CONSTRAINT `ProvinceQuinielaDrawLottery_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobRun` ADD CONSTRAINT `JobRun_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `ScheduledJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobRun` ADD CONSTRAINT `JobRun_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- "Nacional" is today Lotería de la Ciudad (code 2 in Lotería de la Provincia's program).
UPDATE `Lottery` SET `code` = 'CIUDAD', `name` = 'Ciudad' WHERE `code` = 'NACIONAL';
UPDATE `Lottery` SET `name` = 'Provincia' WHERE `code` = 'PROVINCIA';

-- Mendoza is not part of Lotería de la Provincia's Quiniela program.
UPDATE `ProvinceLotteryAvailability` a JOIN `Province` p ON p.`id` = a.`provinceId` JOIN `Lottery` l ON l.`id` = a.`lotteryId`
SET a.`enabled` = false WHERE p.`code` = 'B' AND l.`code` = 'MENDOZA';

-- Quiniela in Buenos Aires: "Valor máximo: $5.000 por C/Lotería".
UPDATE `ProvinceGameAvailability` a JOIN `Province` p ON p.`id` = a.`provinceId` JOIN `GameDefinition` g ON g.`id` = a.`gameId`
SET a.`maxBetAmount` = 5000.00 WHERE p.`code` = 'B' AND g.`code` = 'QUINIELA';

-- Existing (demo) draws: every lottery enabled in their province takes part.
INSERT INTO `ProvinceQuinielaDrawLottery` (`drawId`, `lotteryId`, `drawNumber`)
  SELECT dr.`id`, a.`lotteryId`, NULL
  FROM `ProvinceQuinielaProgramDayDraw` dr
  JOIN `ProvinceQuinielaProgramDay` d ON d.`id` = dr.`dayId`
  JOIN `ProvinceQuinielaMonthlyProgram` pr ON pr.`id` = d.`programId`
  JOIN `ProvinceLotteryAvailability` a ON a.`provinceId` = pr.`provinceId` AND a.`enabled` = true;

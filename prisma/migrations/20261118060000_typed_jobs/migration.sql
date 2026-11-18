-- Scheduled jobs get a type (Quiniela program, Quiniela results, holidays) and, for
-- province-level types, their province and source website. The handler is chosen by type + source.

-- AlterTable (type nullable first, filled below, then required)
ALTER TABLE `ScheduledJob` ADD COLUMN `provinceId` VARCHAR(191) NULL,
    ADD COLUMN `source` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('QUINIELA_PROGRAM', 'QUINIELA_RESULTS', 'HOLIDAYS') NULL;

UPDATE `ScheduledJob` j
    JOIN `Province` p ON p.`code` = 'B'
SET j.`type` = 'QUINIELA_PROGRAM', j.`provinceId` = p.`id`, j.`source` = 'loteria-gba'
WHERE j.`key` = 'quiniela-program-B';

UPDATE `ScheduledJob` SET `type` = 'HOLIDAYS' WHERE `key` = 'holidays-sync';

-- Any other job left without a type is unknown to the code: drop it (its runs go with it).
DELETE FROM `ScheduledJob` WHERE `type` IS NULL;

ALTER TABLE `ScheduledJob` MODIFY `type` ENUM('QUINIELA_PROGRAM', 'QUINIELA_RESULTS', 'HOLIDAYS') NOT NULL;

-- AddForeignKey
ALTER TABLE `ScheduledJob` ADD CONSTRAINT `ScheduledJob_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

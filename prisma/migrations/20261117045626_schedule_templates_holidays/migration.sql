-- Agency schedule: templates shared by several agencies, date-range exceptions with
-- time slots (agency or template scope) and the national holiday calendar.
-- AgencyScheduleException was empty and unused (checked) and is replaced by ScheduleException.
-- DropForeignKey
ALTER TABLE `AgencyScheduleException` DROP FOREIGN KEY `AgencyScheduleException_agencyId_fkey`;

-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `scheduleTemplateId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `AgencyScheduleException`;

-- CreateTable
CREATE TABLE `ScheduleTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleTemplate_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleTemplateRule` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `opensAt` TIME(0) NOT NULL,
    `closesAt` TIME(0) NOT NULL,

    INDEX `ScheduleTemplateRule_templateId_weekday_idx`(`templateId`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleException` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `kind` ENUM('CLOSED', 'SPECIAL_HOURS') NOT NULL DEFAULT 'CLOSED',
    `reason` VARCHAR(191) NULL,
    `holidayId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleException_agencyId_startDate_idx`(`agencyId`, `startDate`),
    INDEX `ScheduleException_templateId_startDate_idx`(`templateId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleExceptionSlot` (
    `id` VARCHAR(191) NOT NULL,
    `exceptionId` VARCHAR(191) NOT NULL,
    `opensAt` TIME(0) NOT NULL,
    `closesAt` TIME(0) NOT NULL,

    INDEX `ScheduleExceptionSlot_exceptionId_idx`(`exceptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('FIXED', 'MOVABLE', 'BRIDGE') NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'argentinadatos',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Holiday_date_idx`(`date`),
    UNIQUE INDEX `Holiday_date_name_key`(`date`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Agency` ADD CONSTRAINT `Agency_scheduleTemplateId_fkey` FOREIGN KEY (`scheduleTemplateId`) REFERENCES `ScheduleTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleTemplate` ADD CONSTRAINT `ScheduleTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleTemplateRule` ADD CONSTRAINT `ScheduleTemplateRule_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ScheduleTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleException` ADD CONSTRAINT `ScheduleException_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleException` ADD CONSTRAINT `ScheduleException_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ScheduleTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleException` ADD CONSTRAINT `ScheduleException_holidayId_fkey` FOREIGN KEY (`holidayId`) REFERENCES `Holiday`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleExceptionSlot` ADD CONSTRAINT `ScheduleExceptionSlot_exceptionId_fkey` FOREIGN KEY (`exceptionId`) REFERENCES `ScheduleException`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity rules (spec agency-schedule).
ALTER TABLE `ScheduleException` ADD CONSTRAINT `ScheduleException_dates` CHECK (`endDate` >= `startDate`);
ALTER TABLE `ScheduleExceptionSlot` ADD CONSTRAINT `ScheduleExceptionSlot_range` CHECK (`closesAt` > `opensAt`);
ALTER TABLE `ScheduleTemplateRule` ADD CONSTRAINT `ScheduleTemplateRule_range` CHECK (`closesAt` > `opensAt` AND `weekday` BETWEEN 0 AND 6);
ALTER TABLE `AgencyScheduleRule` ADD CONSTRAINT `AgencyScheduleRule_range` CHECK (`closesAt` > `opensAt` AND `weekday` BETWEEN 0 AND 6);

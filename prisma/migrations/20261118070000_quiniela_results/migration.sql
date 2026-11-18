-- Quiniela results: what each source published (readings) and the consolidated result per draw.
-- CreateTable
CREATE TABLE `QuinielaResultReading` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `numbers` VARCHAR(160) NOT NULL,
    `letters` VARCHAR(20) NULL,
    `official` BOOLEAN NOT NULL DEFAULT false,
    `jobRunId` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuinielaResultReading_date_slot_lotteryId_idx`(`date`, `slot`, `lotteryId`),
    UNIQUE INDEX `QuinielaResultReading_source_date_slot_lotteryId_key`(`source`, `date`, `slot`, `lotteryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuinielaResult` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CONFLICT') NOT NULL DEFAULT 'PENDING',
    `letters` VARCHAR(20) NULL,
    `sources` INTEGER NOT NULL DEFAULT 0,
    `confirmedAt` DATETIME(3) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuinielaResult_date_status_idx`(`date`, `status`),
    UNIQUE INDEX `QuinielaResult_date_slot_lotteryId_key`(`date`, `slot`, `lotteryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuinielaResultNumber` (
    `resultId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `number` VARCHAR(6) NOT NULL,

    PRIMARY KEY (`resultId`, `position`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuinielaResultReading` ADD CONSTRAINT `QuinielaResultReading_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuinielaResultReading` ADD CONSTRAINT `QuinielaResultReading_jobRunId_fkey` FOREIGN KEY (`jobRunId`) REFERENCES `JobRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuinielaResult` ADD CONSTRAINT `QuinielaResult_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuinielaResult` ADD CONSTRAINT `QuinielaResult_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuinielaResultNumber` ADD CONSTRAINT `QuinielaResultNumber_resultId_fkey` FOREIGN KEY (`resultId`) REFERENCES `QuinielaResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


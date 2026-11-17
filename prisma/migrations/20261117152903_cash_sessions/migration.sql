-- Cash sessions per shift (spec agency-finances); movements may belong to one.
-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `cashSessionsPerDay` INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE `FundMovement` ADD COLUMN `cashSessionId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CashSession` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `shift` ENUM('MORNING', 'AFTERNOON', 'SINGLE') NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `openingCash` DECIMAL(14, 2) NOT NULL,
    `openedById` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `countedCash` DECIMAL(14, 2) NULL,
    `closedById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,

    INDEX `CashSession_agencyId_date_idx`(`agencyId`, `date`),
    UNIQUE INDEX `CashSession_agencyId_date_shift_key`(`agencyId`, `date`, `shift`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `FundMovement_cashSessionId_idx` ON `FundMovement`(`cashSessionId`);

-- AddForeignKey
ALTER TABLE `FundMovement` ADD CONSTRAINT `FundMovement_cashSessionId_fkey` FOREIGN KEY (`cashSessionId`) REFERENCES `CashSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE `Agency` ADD CONSTRAINT `Agency_cashSessionsPerDay_range` CHECK (`cashSessionsPerDay` IN (1, 2));
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_cash_not_negative` CHECK (`openingCash` >= 0 AND (`countedCash` IS NULL OR `countedCash` >= 0));

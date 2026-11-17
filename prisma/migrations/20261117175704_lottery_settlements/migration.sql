-- Daily Lotería settlement tickets; bank account number on payment methods (spec agency-finances).
-- AlterTable
ALTER TABLE `AgencyFund` ADD COLUMN `accountNumber` VARCHAR(30) NULL;

-- CreateTable
CREATE TABLE `LotterySettlement` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `issueDate` DATE NOT NULL,
    `issuedAt` DATETIME(3) NULL,
    `dueDate` DATE NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `direction` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `accountNumber` VARCHAR(30) NULL,
    `ticketKey` VARCHAR(500) NULL,
    `ticketMime` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `movementId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `voidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LotterySettlement_movementId_key`(`movementId`),
    INDEX `LotterySettlement_agencyId_dueDate_idx`(`agencyId`, `dueDate`),
    UNIQUE INDEX `LotterySettlement_agencyId_issueDate_key`(`agencyId`, `issueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LotterySettlement` ADD CONSTRAINT `LotterySettlement_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotterySettlement` ADD CONSTRAINT `LotterySettlement_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `FundMovement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LotterySettlement` ADD CONSTRAINT `LotterySettlement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE `LotterySettlement` ADD CONSTRAINT `LotterySettlement_amount_positive` CHECK (`amount` > 0);

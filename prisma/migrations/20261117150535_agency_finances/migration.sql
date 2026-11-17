-- Agency finances: payment methods per agency and their movements (spec agency-finances).
-- CreateTable
CREATE TABLE `AgencyFund` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `kind` ENUM('CASH', 'BANK_ACCOUNT', 'DIGITAL_WALLET', 'CARD_TERMINAL', 'OTHER') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `holderName` VARCHAR(191) NULL,
    `cbuCvu` VARCHAR(22) NULL,
    `alias` VARCHAR(40) NULL,
    `merchantNumber` VARCHAR(40) NULL,
    `reference` VARCHAR(191) NULL,
    `showToCustomers` BOOLEAN NOT NULL DEFAULT false,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `openingDate` DATE NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgencyFund_agencyId_idx`(`agencyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FundMovement` (
    `id` VARCHAR(191) NOT NULL,
    `fundId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `kind` ENUM('LOTTERY_DEBIT', 'LOTTERY_CREDIT', 'CUSTOMER_PAYMENT', 'PRIZE_PAYOUT', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'OTHER') NOT NULL,
    `description` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `source` ENUM('MANUAL', 'LOTTERY_TICKET', 'CASH_CLOSING') NOT NULL DEFAULT 'MANUAL',
    `transferId` VARCHAR(30) NULL,
    `attachmentKey` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FundMovement_fundId_date_idx`(`fundId`, `date`),
    INDEX `FundMovement_transferId_idx`(`transferId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencyFund` ADD CONSTRAINT `AgencyFund_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FundMovement` ADD CONSTRAINT `FundMovement_fundId_fkey` FOREIGN KEY (`fundId`) REFERENCES `AgencyFund`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FundMovement` ADD CONSTRAINT `FundMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity rules.
ALTER TABLE `FundMovement` ADD CONSTRAINT `FundMovement_amount_positive` CHECK (`amount` > 0);
ALTER TABLE `AgencyFund` ADD CONSTRAINT `AgencyFund_cbuCvu_digits` CHECK (`cbuCvu` IS NULL OR `cbuCvu` REGEXP '^[0-9]{22}$');

-- Defaults for existing agencies: cash and their bank account, opening at 0 today.
INSERT INTO `AgencyFund` (`id`, `agencyId`, `kind`, `name`, `openingBalance`, `openingDate`, `sortOrder`, `updatedAt`)
SELECT REPLACE(UUID(), '-', ''), a.`id`, 'CASH', 'Efectivo', 0, CURDATE(), 0, CURRENT_TIMESTAMP(3) FROM `Agency` a;
INSERT INTO `AgencyFund` (`id`, `agencyId`, `kind`, `name`, `openingBalance`, `openingDate`, `sortOrder`, `updatedAt`)
SELECT REPLACE(UUID(), '-', ''), a.`id`, 'BANK_ACCOUNT', 'Cuenta bancaria', 0, CURDATE(), 1, CURRENT_TIMESTAMP(3) FROM `Agency` a;

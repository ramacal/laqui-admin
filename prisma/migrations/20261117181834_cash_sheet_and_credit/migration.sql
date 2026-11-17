-- Cash closing like the paper "Caja diaria" (machine sales, physical items) and fiados.
-- AlterTable
ALTER TABLE `CashSession` ADD COLUMN `machineSales` DECIMAL(14, 2) NULL;

-- AlterTable
ALTER TABLE `FundMovement` MODIFY `kind` ENUM('LOTTERY_DEBIT', 'LOTTERY_CREDIT', 'SALE', 'CASH_IN', 'WITHDRAWAL', 'CUSTOMER_PAYMENT', 'PRIZE_PAYOUT', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'OTHER') NOT NULL;

-- CreateTable
CREATE TABLE `CashSessionItem` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NULL,
    `ownerProductId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,

    UNIQUE INDEX `CashSessionItem_sessionId_gameId_key`(`sessionId`, `gameId`),
    UNIQUE INDEX `CashSessionItem_sessionId_ownerProductId_key`(`sessionId`, `ownerProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditAccount` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreditAccount_agencyId_name_idx`(`agencyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditEntry` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `kind` ENUM('CHARGE', 'PAYMENT') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `date` DATE NOT NULL,
    `description` VARCHAR(191) NULL,
    `cashSessionId` VARCHAR(191) NULL,
    `movementId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreditEntry_movementId_key`(`movementId`),
    INDEX `CreditEntry_accountId_date_idx`(`accountId`, `date`),
    INDEX `CreditEntry_cashSessionId_idx`(`cashSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CashSessionItem` ADD CONSTRAINT `CashSessionItem_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CashSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSessionItem` ADD CONSTRAINT `CashSessionItem_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSessionItem` ADD CONSTRAINT `CashSessionItem_ownerProductId_fkey` FOREIGN KEY (`ownerProductId`) REFERENCES `OwnerProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `CreditAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_cashSessionId_fkey` FOREIGN KEY (`cashSessionId`) REFERENCES `CashSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `FundMovement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules MySQL can check (amounts and quantities are positive).
ALTER TABLE `CashSessionItem` ADD CONSTRAINT `CashSessionItem_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `CreditEntry` ADD CONSTRAINT `CreditEntry_amount_check` CHECK (`amount` > 0);
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_machineSales_check` CHECK (`machineSales` IS NULL OR `machineSales` >= 0);

-- Raspaditas: official products sold by unit (counted in the cash closing), offered in Buenos Aires.
INSERT INTO `GameDefinition` (`id`, `code`, `name`, `kind`, `saleMode`, `active`, `createdAt`, `updatedAt`) VALUES
  ('game_raspadita_500', 'RASPADITA_500', 'Raspadita $500', 'UNIT', 'PHYSICAL', true, NOW(3), NOW(3)),
  ('game_raspadita_1000', 'RASPADITA_1000', 'Raspadita $1000', 'UNIT', 'PHYSICAL', true, NOW(3), NOW(3));
INSERT INTO `GamePrice` (`id`, `gameId`, `amount`, `validFrom`, `note`, `createdAt`) VALUES
  ('price_raspadita_500', 'game_raspadita_500', 500.00, '2026-11-01', NULL, NOW(3)),
  ('price_raspadita_1000', 'game_raspadita_1000', 1000.00, '2026-11-01', NULL, NOW(3));
INSERT INTO `ProvinceGameAvailability` (`provinceId`, `gameId`, `enabled`, `customPrice`)
  SELECT p.`id`, g.`id`, true, false FROM `Province` p JOIN `GameDefinition` g ON g.`code` IN ('RASPADITA_500', 'RASPADITA_1000')
  WHERE p.`code` = 'B';

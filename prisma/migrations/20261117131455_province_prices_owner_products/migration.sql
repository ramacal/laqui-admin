-- Base product prices per province with validity; owner products offered per agency.
-- DropForeignKey
ALTER TABLE `Order` DROP FOREIGN KEY `Order_gameId_fkey`;
-- DropIndex
DROP INDEX `Order_gameId_fkey` ON `Order`;
-- CreateTable
CREATE TABLE `ProvinceGamePrice` (
    `id` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `validFrom` DATE NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ProvinceGamePrice_provinceId_gameId_validFrom_key`(`provinceId`, `gameId`, `validFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Keep current prices: copy each game's global price (or Quiniela's minimum per line)
-- into every province where it is offered, valid from 2026-01-01, before dropping the columns.
INSERT INTO `ProvinceGamePrice` (`id`, `provinceId`, `gameId`, `amount`, `validFrom`, `note`, `createdAt`)
SELECT REPLACE(UUID(), '-', ''), pga.`provinceId`, pga.`gameId`, COALESCE(g.`basePrice`, g.`minLineAmount`), '2026-01-01', 'Precio inicial (migrado)', CURRENT_TIMESTAMP(3)
FROM `ProvinceGameAvailability` pga
JOIN `GameDefinition` g ON g.`id` = pga.`gameId`
WHERE COALESCE(g.`basePrice`, g.`minLineAmount`) IS NOT NULL;

-- AlterTable
ALTER TABLE `GameDefinition` DROP COLUMN `basePrice`,
    DROP COLUMN `minLineAmount`;
-- AlterTable
ALTER TABLE `Order` MODIFY `gameId` VARCHAR(191) NULL;
-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `ownerProductId` VARCHAR(191) NULL,
    ADD COLUMN `productName` VARCHAR(191) NULL,
    ADD COLUMN `quantity` INTEGER NULL,
    ADD COLUMN `unitPrice` DECIMAL(12, 2) NULL,
    MODIFY `kind` ENUM('QUINIELA_DIRECT', 'QUINIELA_REDOBLONA', 'NUMBER_PICK', 'OWNER_PRODUCT') NOT NULL;
-- CreateTable
CREATE TABLE `OwnerProduct` (
    `id` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageKey` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `availableFrom` DATE NULL,
    `availableUntil` DATE NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `OwnerProduct_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `OwnerProductPrice` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `validFrom` DATE NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `OwnerProductPrice_productId_validFrom_key`(`productId`, `validFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `OwnerProductAgency` (
    `productId` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    INDEX `OwnerProductAgency_agencyId_idx`(`agencyId`),
    PRIMARY KEY (`productId`, `agencyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- AddForeignKey
ALTER TABLE `ProvinceGamePrice` ADD CONSTRAINT `ProvinceGamePrice_provinceId_gameId_fkey` FOREIGN KEY (`provinceId`, `gameId`) REFERENCES `ProvinceGameAvailability`(`provinceId`, `gameId`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_ownerProductId_fkey` FOREIGN KEY (`ownerProductId`) REFERENCES `OwnerProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `OwnerProduct` ADD CONSTRAINT `OwnerProduct_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `OwnerProductPrice` ADD CONSTRAINT `OwnerProductPrice_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `OwnerProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `OwnerProductAgency` ADD CONSTRAINT `OwnerProductAgency_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `OwnerProduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `OwnerProductAgency` ADD CONSTRAINT `OwnerProductAgency_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

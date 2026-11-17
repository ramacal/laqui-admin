-- File storage: agency logo assets and bet ticket photos. Agency.logoUrl was empty in every row (checked) and is replaced by AgencyAsset.
-- AlterTable
ALTER TABLE `Agency` DROP COLUMN `logoUrl`;

-- CreateTable
CREATE TABLE `AgencyAsset` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `kind` ENUM('LOGO_SYMBOL', 'LOGO_SYMBOL_VECTOR', 'LOGO_MAIN', 'PROFILE_PICTURE') NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgencyAsset_agencyId_kind_key`(`agencyId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BetTicket` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BetTicket_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencyAsset` ADD CONSTRAINT `AgencyAsset_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BetTicket` ADD CONSTRAINT `BetTicket_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BetTicket` ADD CONSTRAINT `BetTicket_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `AgencyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


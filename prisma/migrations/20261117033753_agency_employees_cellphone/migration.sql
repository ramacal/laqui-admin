-- Rename whatsappNumber -> cellphoneNumber, keeping existing data.
ALTER TABLE `Agency` RENAME COLUMN `whatsappNumber` TO `cellphoneNumber`;
ALTER TABLE `Customer` RENAME COLUMN `whatsappNumber` TO `cellphoneNumber`;
ALTER TABLE `Customer` RENAME INDEX `Customer_whatsappNumber_key` TO `Customer_cellphoneNumber_key`;

-- Agency file number ("legajo"). Existing rows get a unique placeholder to fill in later.
ALTER TABLE `Agency` ADD COLUMN `licenseNumber` VARCHAR(20) NULL;
UPDATE `Agency` SET `licenseNumber` = CONCAT('PEND-', RIGHT(`id`, 15)) WHERE `licenseNumber` IS NULL;
ALTER TABLE `Agency` MODIFY `licenseNumber` VARCHAR(20) NOT NULL;
CREATE UNIQUE INDEX `Agency_provinceId_licenseNumber_key` ON `Agency`(`provinceId`, `licenseNumber`);

-- CreateTable
CREATE TABLE `AgencyEmployee` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `cuil` VARCHAR(11) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(191) NULL,
    `street` VARCHAR(191) NOT NULL,
    `streetNumber` VARCHAR(10) NOT NULL,
    `floorApartment` VARCHAR(20) NULL,
    `city` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(10) NULL,
    `addressProvinceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `AgencyEmployee_cuil_idx`(`cuil`),
    UNIQUE INDEX `AgencyEmployee_agencyId_cuil_key`(`agencyId`, `cuil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencyEmployee` ADD CONSTRAINT `AgencyEmployee_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AgencyEmployee` ADD CONSTRAINT `AgencyEmployee_addressProvinceId_fkey` FOREIGN KEY (`addressProvinceId`) REFERENCES `Province`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Real agency data: optional WhatsApp/contact/address on Agency, optional personal data on employees.
-- Only adds columns and relaxes NOT NULL, so existing rows are kept as-is.
-- DropForeignKey
ALTER TABLE `AgencyEmployee` DROP FOREIGN KEY `AgencyEmployee_addressProvinceId_fkey`;

-- DropIndex
DROP INDEX `AgencyEmployee_addressProvinceId_fkey` ON `AgencyEmployee`;

-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `licenseHolder` VARCHAR(191) NULL,
    ADD COLUMN `street` VARCHAR(191) NULL,
    ADD COLUMN `streetNumber` VARCHAR(10) NULL,
    MODIFY `cellphoneNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AgencyEmployee` ADD COLUMN `hiredAt` DATE NULL,
    MODIFY `cuil` VARCHAR(11) NULL,
    MODIFY `phone` VARCHAR(20) NULL,
    MODIFY `street` VARCHAR(191) NULL,
    MODIFY `streetNumber` VARCHAR(10) NULL,
    MODIFY `city` VARCHAR(191) NULL,
    MODIFY `addressProvinceId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `AgencyEmployee` ADD CONSTRAINT `AgencyEmployee_addressProvinceId_fkey` FOREIGN KEY (`addressProvinceId`) REFERENCES `Province`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


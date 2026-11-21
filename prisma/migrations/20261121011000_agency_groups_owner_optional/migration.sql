-- DropForeignKey
ALTER TABLE `OwnerProduct` DROP FOREIGN KEY `OwnerProduct_ownerUserId_fkey`;

-- DropForeignKey
ALTER TABLE `ScheduleTemplate` DROP FOREIGN KEY `ScheduleTemplate_ownerUserId_fkey`;

-- DropIndex
DROP INDEX `ScheduleTemplate_ownerUserId_idx` ON `ScheduleTemplate`;

-- AlterTable
ALTER TABLE `OwnerProduct` MODIFY `ownerUserId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ScheduleTemplate` MODIFY `ownerUserId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `ScheduleTemplate` ADD CONSTRAINT `ScheduleTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerProduct` ADD CONSTRAINT `OwnerProduct_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

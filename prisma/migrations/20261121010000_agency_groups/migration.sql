-- AlterTable
ALTER TABLE `Agency` ADD COLUMN `groupId` VARCHAR(191) NULL,
    ADD COLUMN `titularCuil` VARCHAR(11) NULL,
    ADD COLUMN `titularEmail` VARCHAR(191) NULL,
    ADD COLUMN `titularFirstName` VARCHAR(191) NULL,
    ADD COLUMN `titularLastName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `OwnerProduct` ADD COLUMN `groupId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ScheduleTemplate` ADD COLUMN `groupId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AgencyGroup` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgencyGroup_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyGroupOwner` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgencyGroupOwner_userId_idx`(`userId`),
    UNIQUE INDEX `AgencyGroupOwner_groupId_email_key`(`groupId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyGroupEvent` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `kind` ENUM('OWNER_ADDED', 'OWNER_REMOVED', 'AGENCY_MOVED_IN', 'AGENCY_MOVED_OUT') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `detail` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgencyGroupEvent_groupId_createdAt_idx`(`groupId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Agency_groupId_idx` ON `Agency`(`groupId`);

-- CreateIndex
CREATE INDEX `OwnerProduct_groupId_idx` ON `OwnerProduct`(`groupId`);

-- CreateIndex
CREATE UNIQUE INDEX `ScheduleTemplate_groupId_key` ON `ScheduleTemplate`(`groupId`);

-- AddForeignKey
ALTER TABLE `Agency` ADD CONSTRAINT `Agency_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AgencyGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGroupOwner` ADD CONSTRAINT `AgencyGroupOwner_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AgencyGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGroupOwner` ADD CONSTRAINT `AgencyGroupOwner_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGroupEvent` ADD CONSTRAINT `AgencyGroupEvent_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AgencyGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGroupEvent` ADD CONSTRAINT `AgencyGroupEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleTemplate` ADD CONSTRAINT `ScheduleTemplate_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AgencyGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerProduct` ADD CONSTRAINT `OwnerProduct_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `AgencyGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

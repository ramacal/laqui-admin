-- CreateTable
CREATE TABLE `AgencyDriveConnection` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `googleEmail` VARCHAR(191) NOT NULL,
    `googleAccountId` VARCHAR(100) NOT NULL,
    `refreshTokenEnc` TEXT NULL,
    `rootFolderId` VARCHAR(100) NOT NULL,
    `folderId` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'NEEDS_RECONNECT', 'DISCONNECTED') NOT NULL DEFAULT 'ACTIVE',
    `lastError` VARCHAR(500) NULL,
    `connectedById` VARCHAR(191) NULL,
    `connectedAt` DATETIME(3) NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgencyDriveConnection_agencyId_key`(`agencyId`),
    INDEX `AgencyDriveConnection_googleAccountId_idx`(`googleAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyDriveShare` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `state` ENUM('SHARED', 'MANUAL', 'FAILED') NOT NULL,
    `permissionId` VARCHAR(100) NULL,
    `role` VARCHAR(20) NOT NULL,
    `error` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgencyDriveShare_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `AgencyDriveShare_connectionId_email_key`(`connectionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencyDriveConnection` ADD CONSTRAINT `AgencyDriveConnection_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyDriveConnection` ADD CONSTRAINT `AgencyDriveConnection_connectedById_fkey` FOREIGN KEY (`connectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyDriveShare` ADD CONSTRAINT `AgencyDriveShare_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `AgencyDriveConnection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyDriveShare` ADD CONSTRAINT `AgencyDriveShare_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `AgencyEmployee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

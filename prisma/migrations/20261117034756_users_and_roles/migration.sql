-- Agency role MANAGER becomes ADMIN. Widen the enum, move existing rows, then narrow it.
ALTER TABLE `AgencyEmployee` MODIFY `role` ENUM('OWNER', 'MANAGER', 'ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE';
UPDATE `AgencyEmployee` SET `role` = 'ADMIN' WHERE `role` = 'MANAGER';
ALTER TABLE `AgencyEmployee` MODIFY `role` ENUM('OWNER', 'ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE';

-- Optional login link for employees.
ALTER TABLE `AgencyEmployee` ADD COLUMN `userId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` VARCHAR(500) NULL,
    `platformRole` ENUM('NONE', 'PLATFORM_ADMIN') NOT NULL DEFAULT 'NONE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AgencyEmployee_agencyId_userId_key` ON `AgencyEmployee`(`agencyId`, `userId`);

-- AddForeignKey
ALTER TABLE `AgencyEmployee` ADD CONSTRAINT `AgencyEmployee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

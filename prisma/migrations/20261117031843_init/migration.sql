-- CreateTable
CREATE TABLE `GameDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('QUINIELA', 'NUMBER_PICK') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `basePrice` DECIMAL(12, 2) NULL,
    `pickCount` INTEGER NULL,
    `minNumber` INTEGER NULL,
    `maxNumber` INTEGER NULL,
    `extraMin` INTEGER NULL,
    `extraMax` INTEGER NULL,
    `minLineAmount` DECIMAL(12, 2) NULL,
    `maxDigits` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GameDefinition_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameModality` (
    `id` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `includedInComplete` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `GameModality_gameId_code_key`(`gameId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Province` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Province_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceGameAvailability` (
    `provinceId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`provinceId`, `gameId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lottery` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Lottery_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceLotteryAvailability` (
    `provinceId` VARCHAR(191) NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`provinceId`, `lotteryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceQuinielaMonthlyProgram` (
    `id` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `sourceFileKey` VARCHAR(500) NULL,
    `rawParse` JSON NULL,
    `draft` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProvinceQuinielaMonthlyProgram_provinceId_year_month_status_idx`(`provinceId`, `year`, `month`, `status`),
    UNIQUE INDEX `ProvinceQuinielaMonthlyProgram_provinceId_year_month_version_key`(`provinceId`, `year`, `month`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceQuinielaProgramDay` (
    `id` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ProvinceQuinielaProgramDay_programId_date_key`(`programId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProvinceQuinielaProgramDayDraw` (
    `id` VARCHAR(191) NOT NULL,
    `dayId` VARCHAR(191) NOT NULL,
    `slot` ENUM('PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA') NOT NULL,
    `drawTime` TIME(0) NOT NULL,
    `closeTime` TIME(0) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ProvinceQuinielaProgramDayDraw_dayId_slot_key`(`dayId`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Agency` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provinceId` VARCHAR(191) NOT NULL,
    `whatsappNumber` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    `logoUrl` VARCHAR(500) NULL,
    `primaryColor` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Agency_slug_key`(`slug`),
    INDEX `Agency_provinceId_idx`(`provinceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyGameAvailability` (
    `agencyId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`agencyId`, `gameId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyScheduleRule` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `opensAt` TIME(0) NOT NULL,
    `closesAt` TIME(0) NOT NULL,

    INDEX `AgencyScheduleRule_agencyId_weekday_idx`(`agencyId`, `weekday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyScheduleException` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `closed` BOOLEAN NOT NULL DEFAULT true,
    `opensAt` TIME(0) NULL,
    `closesAt` TIME(0) NULL,
    `note` TEXT NULL,

    UNIQUE INDEX `AgencyScheduleException_agencyId_date_key`(`agencyId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `whatsappNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_whatsappNumber_key`(`whatsappNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgencyCustomer` (
    `agencyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`agencyId`, `customerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `status` ENUM('CREATED', 'RECEIPT_UPLOADED', 'CONFIRMED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
    `total` DECIMAL(12, 2) NOT NULL,
    `whatsappTarget` VARCHAR(191) NOT NULL,
    `whatsappMessage` TEXT NOT NULL,
    `publicToken` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_publicToken_key`(`publicToken`),
    INDEX `Order_agencyId_createdAt_idx`(`agencyId`, `createdAt`),
    INDEX `Order_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderQuinielaDraw` (
    `orderId` VARCHAR(191) NOT NULL,
    `drawId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`orderId`, `drawId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderQuinielaLottery` (
    `orderId` VARCHAR(191) NOT NULL,
    `lotteryId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`orderId`, `lotteryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `kind` ENUM('QUINIELA_DIRECT', 'QUINIELA_REDOBLONA', 'NUMBER_PICK') NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `amount` DECIMAL(12, 2) NOT NULL,
    `number` VARCHAR(191) NULL,
    `placement` INTEGER NULL,
    `number2` VARCHAR(191) NULL,
    `placement2` INTEGER NULL,
    `derivedFromId` VARCHAR(191) NULL,
    `extraNumber` INTEGER NULL,
    `modality` VARCHAR(191) NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItemPick` (
    `itemId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,

    UNIQUE INDEX `OrderItemPick_itemId_number_key`(`itemId`, `number`),
    PRIMARY KEY (`itemId`, `position`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Receipt` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `status` ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Receipt_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GameModality` ADD CONSTRAINT `GameModality_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceGameAvailability` ADD CONSTRAINT `ProvinceGameAvailability_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceGameAvailability` ADD CONSTRAINT `ProvinceGameAvailability_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceLotteryAvailability` ADD CONSTRAINT `ProvinceLotteryAvailability_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceLotteryAvailability` ADD CONSTRAINT `ProvinceLotteryAvailability_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaMonthlyProgram` ADD CONSTRAINT `ProvinceQuinielaMonthlyProgram_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaProgramDay` ADD CONSTRAINT `ProvinceQuinielaProgramDay_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ProvinceQuinielaMonthlyProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceQuinielaProgramDayDraw` ADD CONSTRAINT `ProvinceQuinielaProgramDayDraw_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `ProvinceQuinielaProgramDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Agency` ADD CONSTRAINT `Agency_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGameAvailability` ADD CONSTRAINT `AgencyGameAvailability_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyGameAvailability` ADD CONSTRAINT `AgencyGameAvailability_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyScheduleRule` ADD CONSTRAINT `AgencyScheduleRule_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyScheduleException` ADD CONSTRAINT `AgencyScheduleException_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyCustomer` ADD CONSTRAINT `AgencyCustomer_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgencyCustomer` ADD CONSTRAINT `AgencyCustomer_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderQuinielaDraw` ADD CONSTRAINT `OrderQuinielaDraw_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderQuinielaDraw` ADD CONSTRAINT `OrderQuinielaDraw_drawId_fkey` FOREIGN KEY (`drawId`) REFERENCES `ProvinceQuinielaProgramDayDraw`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderQuinielaLottery` ADD CONSTRAINT `OrderQuinielaLottery_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderQuinielaLottery` ADD CONSTRAINT `OrderQuinielaLottery_lotteryId_fkey` FOREIGN KEY (`lotteryId`) REFERENCES `Lottery`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_derivedFromId_fkey` FOREIGN KEY (`derivedFromId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItemPick` ADD CONSTRAINT `OrderItemPick_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

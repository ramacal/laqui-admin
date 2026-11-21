-- AlterTable
ALTER TABLE `Province` ADD COLUMN `brandPrimaryColor` VARCHAR(9) NULL,
    ADD COLUMN `brandSecondaryColor` VARCHAR(9) NULL,
    ADD COLUMN `logoKey` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `AgencySocialAccount` (
    `id` VARCHAR(191) NOT NULL,
    `agencyId` VARCHAR(191) NOT NULL,
    `network` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK') NOT NULL,
    `handle` VARCHAR(60) NOT NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgencySocialAccount_agencyId_network_key`(`agencyId`, `network`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentIdea` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('PATRIOTIC_DATE', 'BIRTH', 'DEATH', 'COMMEMORATION', 'EVENT') NOT NULL,
    `topic` ENUM('PATRIA', 'PROCERES', 'FUTBOL', 'DEPORTES', 'FARANDULA', 'MUSICA', 'STREAMING', 'CULTURA') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `day` INTEGER NOT NULL,
    `year` INTEGER NULL,
    `provinceId` VARCHAR(191) NULL,
    `summary` TEXT NULL,
    `headline` VARCHAR(200) NULL,
    `caption` TEXT NULL,
    `popularity` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `source` ENUM('SEED', 'MANUAL', 'WIKIDATA') NOT NULL DEFAULT 'MANUAL',
    `sourceKey` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentIdea_month_day_idx`(`month`, `day`),
    UNIQUE INDEX `ContentIdea_source_sourceKey_key`(`source`, `sourceKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentIdeaNumber` (
    `id` VARCHAR(191) NOT NULL,
    `ideaId` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `reason` VARCHAR(80) NOT NULL,

    INDEX `ContentIdeaNumber_ideaId_idx`(`ideaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuinielaNumberMeaning` (
    `number` INTEGER NOT NULL,
    `meaning` VARCHAR(191) NOT NULL,
    `usable` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgencySocialAccount` ADD CONSTRAINT `AgencySocialAccount_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `Agency`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentIdea` ADD CONSTRAINT `ContentIdea_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentIdeaNumber` ADD CONSTRAINT `ContentIdeaNumber_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `ContentIdea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

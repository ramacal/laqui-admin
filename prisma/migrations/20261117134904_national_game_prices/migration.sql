-- National price per game with validity; provinces only keep a price of their own when it differs.
-- AlterTable
ALTER TABLE `ProvinceGameAvailability` ADD COLUMN `customPrice` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `GamePrice` (
    `id` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `validFrom` DATE NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GamePrice_gameId_validFrom_key`(`gameId`, `validFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GamePrice` ADD CONSTRAINT `GamePrice_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `GameDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- 1. National history = the province prices (same date across provinces collapses to one row).
INSERT INTO `GamePrice` (`id`, `gameId`, `amount`, `validFrom`, `note`, `createdAt`)
SELECT REPLACE(UUID(), '-', ''), p.`gameId`, MIN(p.`amount`), p.`validFrom`, MIN(p.`note`), CURRENT_TIMESTAMP(3)
FROM `ProvinceGamePrice` p
GROUP BY p.`gameId`, p.`validFrom`;

-- 2. Provinces whose prices differ from the national history keep them as their own.
UPDATE `ProvinceGameAvailability` a
SET a.`customPrice` = true
WHERE EXISTS (
  SELECT 1 FROM `ProvinceGamePrice` p
  WHERE p.`provinceId` = a.`provinceId` AND p.`gameId` = a.`gameId`
    AND NOT EXISTS (
      SELECT 1 FROM `GamePrice` g
      WHERE g.`gameId` = p.`gameId` AND g.`validFrom` = p.`validFrom` AND g.`amount` = p.`amount`
    )
);

-- 3. The rest use the national price: their copies are no longer needed.
DELETE p FROM `ProvinceGamePrice` p
JOIN `ProvinceGameAvailability` a ON a.`provinceId` = p.`provinceId` AND a.`gameId` = p.`gameId`
WHERE a.`customPrice` = false;

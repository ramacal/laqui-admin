-- Raspadita $700: official product sold by unit, offered in Buenos Aires.
INSERT INTO `GameDefinition` (`id`, `code`, `name`, `kind`, `saleMode`, `active`, `createdAt`, `updatedAt`) VALUES
  ('game_raspadita_700', 'RASPADITA_700', 'Raspadita $700', 'UNIT', 'PHYSICAL', true, NOW(3), NOW(3));
INSERT INTO `GamePrice` (`id`, `gameId`, `amount`, `validFrom`, `note`, `createdAt`) VALUES
  ('price_raspadita_700', 'game_raspadita_700', 700.00, '2026-11-01', NULL, NOW(3));
INSERT INTO `ProvinceGameAvailability` (`provinceId`, `gameId`, `enabled`, `customPrice`)
  SELECT p.`id`, 'game_raspadita_700', true, false FROM `Province` p WHERE p.`code` = 'B';

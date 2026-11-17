-- Games sold at Lotería de la Provincia de Buenos Aires terminals (loteria.gba.gob.ar,
-- "Juegos Tradicionales", Nov 2026). All are machine products offered in province B.
-- Prices only where Lotería publishes them; the rest are loaded in "Juegos y precios"
-- (a game without a price is not offered).
INSERT INTO `GameDefinition` (`id`, `code`, `name`, `kind`, `saleMode`, `active`, `pickCount`, `minNumber`, `maxNumber`, `createdAt`, `updatedAt`) VALUES
  ('game_quiniela_plus', 'QUINIELA_PLUS', 'Quiniela Plus', 'NUMBER_PICK', 'MACHINE', true, 8, 0, 99, NOW(3), NOW(3)),
  ('game_instantanea', 'LA_INSTANTANEA', 'La Instantánea', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3)),
  ('game_bailarina', 'LA_BAILARINA', 'La Bailarina', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3)),
  ('game_telekino', 'TELEKINO', 'Telekino', 'NUMBER_PICK', 'MACHINE', true, 15, 1, 25, NOW(3), NOW(3)),
  ('game_tarasca', 'TARASCA', 'La Tarasca', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3)),
  ('game_brinco', 'BRINCO', 'Brinco', 'NUMBER_PICK', 'MACHINE', true, 6, 0, 39, NOW(3), NOW(3)),
  ('game_loto5', 'LOTO_5', 'Loto 5', 'NUMBER_PICK', 'MACHINE', true, 5, 0, 36, NOW(3), NOW(3)),
  ('game_money', 'MONEY', 'Money', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3)),
  ('game_navidad_entero', 'NAVIDAD_2026_ENTERO', 'Gordo de Navidad 2026 (billete entero)', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3)),
  ('game_navidad_decimo', 'NAVIDAD_2026_DECIMO', 'Gordo de Navidad 2026 (décimo)', 'UNIT', 'MACHINE', true, NULL, NULL, NULL, NOW(3), NOW(3));

INSERT INTO `GamePrice` (`id`, `gameId`, `amount`, `validFrom`, `note`, `createdAt`) VALUES
  ('price_quiniela_plus', 'game_quiniela_plus', 1000.00, '2026-11-01', 'Apuesta fija (Quiniela Plus, Super Plus y Chance Plus)', NOW(3)),
  ('price_bailarina', 'game_bailarina', 100.00, '2026-11-01', 'Mínimo por apuesta; máximo $5.000', NOW(3)),
  ('price_navidad_entero', 'game_navidad_entero', 80000.00, '2026-10-13', 'Sorteo 23/12/2026 21:00; cobro hasta 25/01/2027', NOW(3)),
  ('price_navidad_decimo', 'game_navidad_decimo', 8000.00, '2026-10-13', 'Sorteo 23/12/2026 21:00; cobro hasta 25/01/2027', NOW(3));

INSERT INTO `ProvinceGameAvailability` (`provinceId`, `gameId`, `enabled`, `customPrice`)
  SELECT p.`id`, g.`id`, true, false FROM `Province` p JOIN `GameDefinition` g ON g.`id` IN (
    'game_quiniela_plus', 'game_instantanea', 'game_bailarina', 'game_telekino', 'game_tarasca',
    'game_brinco', 'game_loto5', 'game_money', 'game_navidad_entero', 'game_navidad_decimo')
  WHERE p.`code` = 'B';

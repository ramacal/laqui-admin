-- Telekino is sold as a physical card (cartón) by unit and counted in the cash sheet, like the
-- scratch cards: it is not a number-pick machine game.
UPDATE `GameDefinition`
SET `saleMode` = 'PHYSICAL',
    `kind` = 'UNIT',
    `pickCount` = NULL,
    `minNumber` = NULL,
    `maxNumber` = NULL,
    `updatedAt` = NOW(3)
WHERE `code` = 'TELEKINO';

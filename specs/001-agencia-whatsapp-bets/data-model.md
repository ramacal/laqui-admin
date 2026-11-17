# Data Model: Agencia WhatsApp Bets

## Core Entities

- `GameDefinition`
- `Province`
- `ProvinceGameAvailability`
- `ProvinceQuinielaMonthlyProgram`
- `ProvinceQuinielaProgramDay`
- `ProvinceQuinielaProgramDayDraw`
- `Lottery`
- `ProvinceLotteryAvailability`
- `Agency`
- `AgencyGameAvailability`
- `AgencyScheduleRule`
- `AgencyScheduleException`
- `Customer`
- `AgencyCustomer`
- `Order`
- `OrderItem`
- `Receipt`

## Modeling Decisions

- Reglas y precios de juegos: globales.
- Catálogo estándar y calendario de Quiniela: por provincia.
- Exposición de juegos y operación comercial: por agencia.
- Calendario de Quiniela publicado: explícito por día y por sorteo.
- Resultado de importación mensual: guardar crudo y publicar normalizado.


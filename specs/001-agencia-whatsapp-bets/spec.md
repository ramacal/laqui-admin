# Feature Specification: Captura Guiada de Jugadas por Agencia

**Feature Branch**: `001-agencia-whatsapp-bets`  
**Created**: 2026-04-07  
**Status**: Draft

## Product Summary

La plataforma permitirá que una persona ingrese al link público de una agencia, seleccione un juego habilitado, complete una jugada desde un flujo guiado mobile-first y envíe el detalle estructurado al número de WhatsApp de la agencia. Antes de abrir WhatsApp, el sistema persistirá cliente y orden. Luego permitirá subir comprobante de pago asociado a esa orden.

El MVP incluye:

- `Quiniela`
- `Quini 6`
- `Loto Plus`

## Product Model

### Global

Las reglas y precios de los juegos viven a nivel global de plataforma.

### Province

La provincia define:

- catálogo estándar de juegos,
- calendario mensual de Quiniela,
- sorteos diarios disponibles de Quiniela.

### Agency

La agencia define:

- branding,
- slug público,
- número de WhatsApp destino,
- qué juegos expone o no dentro de los permitidos por su provincia,
- horario operativo propio.

## User Stories

### User Story 1 - Quiniela guiada (P1)

Como cliente, quiero completar una boleta de Quiniela desde el link de una agencia para elegir sorteos, loterías, números e importes sin escribir texto libre.

**Acceptance Scenarios**

1. El usuario puede seleccionar uno o más sorteos disponibles del día.
2. El usuario puede seleccionar una o más `lotteries` habilitadas.
3. El usuario puede cargar apuestas directas o redoblonas.
4. El usuario puede usar la opción de “bajar” número cuando esté habilitada.
5. El sistema muestra total final antes de abrir WhatsApp.

### User Story 2 - Registro de cliente y envío a WhatsApp (P1)

Como agencia, quiero que la jugada quede asociada a un cliente identificado por número de WhatsApp antes de abrir el canal de mensajería.

**Acceptance Scenarios**

1. Antes del envío final, el usuario informa nombre y WhatsApp.
2. El sistema crea o reutiliza un `Customer`.
3. El sistema crea la `Order` y sus `OrderItem`.
4. El sistema abre WhatsApp con el mensaje estructurado dirigido al número de la agencia.

### User Story 3 - Quini 6 y Loto Plus (P1)

Como cliente, quiero jugar Quini 6 y Loto Plus desde formularios específicos con reglas claras y precio global fijo.

**Acceptance Scenarios**

1. Quini 6 se captura como una apuesta de 6 números del `00` al `45`.
2. Loto Plus se captura como una apuesta de 6 números del `00` al `45`.
3. Loto Plus incluye número extra del `0` al `9`.
4. El sistema usa modalidad completa por defecto para ambos juegos.

### User Story 4 - Comprobante (P1)

Como cliente, quiero subir la foto del comprobante después de enviar la jugada para que la agencia pueda revisarla fuera de WhatsApp.

**Acceptance Scenarios**

1. El sistema permite subir imagen desde móvil o desktop.
2. La imagen queda asociada a una orden existente.
3. La orden cambia de estado luego de la carga.

### User Story 5 - Backoffice de agencia y provincia (P2)

Como administrador, quiero configurar agencias, provincias, juegos visibles y calendario mensual de Quiniela.

**Acceptance Scenarios**

1. Una agencia puede definir su número de WhatsApp y branding.
2. Una agencia puede decidir qué juegos expone.
3. Una provincia puede tener un programa mensual de Quiniela importado.
4. El calendario publicado queda materializado por día y sorteo.

## Functional Requirements

- El sistema MUST exponer un link público por agencia.
- El sistema MUST ser mobile-first.
- El sistema MUST persistir `Customer` y `Order` antes de abrir WhatsApp.
- El sistema MUST soportar `Quiniela`, `Quini 6` y `Loto Plus` en el MVP.
- El sistema MUST modelar precios y reglas de juego a nivel global.
- El sistema MUST asociar cada agencia a una provincia.
- El sistema MUST tomar el calendario de Quiniela desde la provincia de la agencia.
- El sistema MUST permitir a la agencia decidir qué juegos expone.
- El sistema MUST permitir importar el programa mensual de Quiniela para una provincia.
- El sistema MUST publicar una configuración explícita por día y por sorteo.
- El sistema MUST permitir a la agencia definir horarios operativos y excepciones.

## Quiniela MVP Rules

- Soporta apuestas directas.
- Soporta redoblona.
- Soporta múltiples renglones.
- Soporta múltiples sorteos.
- Soporta múltiples `lotteries`.
- Soporta “bajar” número para generar renglones derivados.
- El monto ingresado es el costo real del renglón.
- Sorteos y `lotteries` multiplican la cantidad de renglones afectados.

## Quini 6 MVP Rules

- El usuario elige 6 números del `00` al `45`.
- La modalidad por defecto es la más completa disponible.
- El precio vive en configuración global del juego.

## Loto Plus MVP Rules

- El usuario elige 6 números del `00` al `45`.
- Participa en `Tradicional`, `Match`, `Desquite` y `Sale o Sale`.
- Incluye un número extra del `0` al `9`.
- Tiene dos sorteos semanales.
- La modalidad por defecto es completa.
- El precio global actual de referencia es `$3000`.

## Non-Functional Requirements

- El flujo principal MUST funcionar desde `320px` de ancho en adelante.
- El sistema MUST ser usable desde celular con controles táctiles grandes y teclado numérico.
- El backend MUST soportar importación mensual de calendario con revisión administrativa.
- El sistema SHOULD guardar el resultado crudo del parseo y una versión publicada normalizada.


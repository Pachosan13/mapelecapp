-- Nota interna del técnico sobre una foto de evidencia.
--
-- Pedido de un técnico de SEMCO vía William (24-ago-2026): "es para ver si pueden que a
-- las fotos se le pueda poner comentarios".
--
-- Por qué una columna NUEVA y no la que ya existe: `media.label` es el PIE DE FOTO que
-- SÍ sale impreso en el PDF del cliente (`lib/reports/pdf.ts`, se dibuja como
-- "Sistema · nota"), y hoy lo escribe el gerente desde el inventario de equipos —32 de
-- las 733 fotos lo traen. Pacho lo frenó a tiempo: "ellos escribirán a su forma, no
-- tienen gramática ni ortografía, eso no puede ir directo". Enchufar ahí lo que teclea
-- el técnico en campo lo mandaba derecho al documento que firma el cliente.
--
-- Así que son dos cosas distintas y se quedan separadas:
--   • `label`         → lo escribe el GERENTE. Sale en el informe del cliente.
--   • `nota_tecnico`  → lo escribe el TÉCNICO. La ve SOLO el gerente. Nunca el PDF.
--
-- Es el mismo par que ya existe en el formulario: "Observaciones del técnico (interno)"
-- dice literal "no se envían al cliente". El técnico ya conoce esa distinción; esto es
-- lo mismo pero pegado a cada foto en vez de suelto al final de la visita.
--
-- NO se agrega policy RLS de UPDATE para el técnico: la escritura va por una server
-- action que primero verifica con el cliente del USUARIO que esa foto sea de su visita
-- (la RLS de SELECT ya lo filtra) y recién entonces escribe con `createAdminClient()`.
-- Es el patrón que ya se usó para `crews` cuando le faltaba la policy de INSERT.

ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS nota_tecnico text;

COMMENT ON COLUMN public.media.nota_tecnico IS
  'Nota interna que el técnico le pone a la foto en campo. La lee el gerente. NUNCA se imprime en el PDF del cliente — para eso está `label`.';

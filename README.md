# Tareas Escolares en Solana

Proyecto final del **Solana Engineering Track: Advanced** de WayLearn.

- **Ruta elegida:** Ruta A, proyecto propio.
- **Program ID en Devnet:** `PEGA_AQUI_TU_PROGRAM_ID`
- **Autor:** TU_NOMBRE_COMPLETO

## Propósito

Un maestro lleva el control de las tareas de sus alumnos en la blockchain de Solana (Devnet). El maestro crea un **grupo**, inscribe **alumnos** y registra las **tareas** que entrega cada alumno; después las califica. Cada entidad es una cuenta propia y solo el maestro (la wallet dueña del grupo) puede modificar sus datos.

## Modelo de cuentas

```
Grupo   <- PDA [b"grupo",  nombre_grupo, maestro]
  └─ Alumno <- PDA [b"alumno", grupo,  id_alumno]
       └─ Tarea  <- PDA [b"tarea",  alumno, clave]
```

| Cuenta | Campos |
| --- | --- |
| Grupo | `owner` (maestro), `nombre_grupo`, `alumnos` (direcciones, máx. 10), `id_counter` |
| Alumno | `id_alumno`, `nombre`, `entregas`, `tareas` (direcciones, máx. 10) |
| Tarea | `clave` (máx. 5, ej. `MAT01`), `titulo`, `calificacion` (0 = sin calificar) |

Cada cuenta se deriva de su padre, así que la pertenencia se garantiza por las semillas: una tarea solo puede ser de su alumno y un alumno solo de su grupo. `has_one = owner` asegura que solo el maestro firma.

## Operaciones

| Instrucción | Tipo | Regla |
| --- | --- | --- |
| `crear_grupo` | Crear | La wallet que firma queda como maestro. |
| `inscribir_alumno` | Crear | Solo el maestro. El programa asigna el ID (`id_counter + 1`). |
| `entregar_tarea` | Crear | Solo el maestro. Un alumno no puede repetir la misma clave. |
| `calificar_tarea` | Modificar | Solo el maestro. **La calificación debe estar entre 1 y 10** (`CalificacionInvalida`). |
| `borrar_tarea` | Cerrar | Cierra la cuenta de la tarea y la quita de la lista del alumno. |
| `dar_baja_alumno` | Cierre condicionado | **Solo si el alumno no tiene tareas** (`AlumnoConTareas`). El ID no se reutiliza. |

Las lecturas (consultar grupo, alumnos y tareas) no necesitan firma.

### Errores del programa

| Código | Nombre | Cuándo |
| --- | --- | --- |
| 6000 | NoOwner | La wallet no es el maestro del grupo. |
| 6001 | TareaNoEncontrada | La tarea no está en la lista del alumno. |
| 6002 | AlumnoConTareas | Baja de un alumno que todavía tiene tareas. |
| 6003 | AlumnoNoInscrito | El alumno no está en la lista del grupo. |
| 6004 | CalificacionInvalida | Calificación 0 o mayor que 10. |

## Aporte propio

Partí del template del bootcamp ([Registro-Ventas-Solana-App](https://github.com/WayLearnLatam/Registro-Ventas-Solana-App)) para la integración de wallet, RPC y Codama, y cambié el caso de uso a tareas escolares:

- `programa/src/lib.rs`: programa nuevo (`escuela`) con cuentas Grupo, Alumno y Tarea, seis instrucciones y la regla de calificación de 1 a 10.
- `scripts/contrato-idl.mjs`: la comprobación del IDL ahora espera el programa `escuela`.
- `src/solana/pdas.ts`, `lecturas.ts`, `acciones.ts`, `validaciones.ts`: derivación de direcciones, lecturas y operaciones del nuevo modelo.
- `src/components/Registro.tsx`: pantalla de grupos, alumnos y tareas con las seis operaciones.
- `tests/integracion-cliente.test.ts`: pruebas de semillas, serialización y roles de cuentas.

## Cómo ejecutarlo

1. Abre el repositorio en **Code → Codespaces → Create codespace on main**. Al crearse instala dependencias y genera el cliente.
2. En la terminal: `npm run dev`.
3. En la pestaña **Ports**, abre el puerto **5173** en una pestaña normal del navegador con tu wallet (Phantom o Solflare) en **Devnet**.
4. Si te falta SOL de prueba, pídelo en [faucet.solana.com](https://faucet.solana.com/).

Comprobaciones automáticas: `npm run verificar` (TypeScript, pruebas y build).

En local: Node 22, `npm install`, `npm run cliente`, `npm run dev`.

### Conectar tu programa

1. Despliega `programa/src/lib.rs` en Devnet desde [Solana Playground](https://beta.solpg.io/).
2. Exporta el IDL desde Playground y guárdalo como `tmp-idl/escuela.json`.
3. Ejecuta `npm run configurar:idl -- ./tmp-idl/escuela.json --program-id TU_PROGRAM_ID` y reinicia `npm run dev`.

## Pruebas y evidencias

Grupo usado: `Grupo 402`, maestro: mi wallet de Devnet.

| # | Caso | Pasos | Resultado esperado | Evidencia |
| --- | --- | --- | --- | --- |
| 1 | Crear grupo y alumno | Crear grupo → Inscribir alumno "Ana López" | Aparece el alumno #1 | [tx](PEGA_LINK) |
| 2 | Entregar tarea | Alumno 1, clave MAT01, título "Derivadas" | La tarea aparece "Sin calificar" | [tx](PEGA_LINK) |
| 3 | Calificar (modificar) | Calificar MAT01 con 9 | La misma tarea muestra 9 | [tx](PEGA_LINK) |
| 4 | Calificación inválida | Calificar MAT01 con 11 | Rechazo `CalificacionInvalida`, sigue en 9 | captura |
| 5 | Borrar tarea | Borrar tarea alumno 1, MAT01 | La tarea desaparece, entregas = 0 | [tx](PEGA_LINK) |
| 6 | Baja de alumno sin tareas | Inscribir "Luis" (#2) → Baja de alumno ID 2 | #2 desaparece, "Último ID" sigue en 2 | [tx](PEGA_LINK) |
| 7 | Baja con tareas (rechazo) | Entregar tarea a #1 → Baja de alumno ID 1 | Rechazo `AlumnoConTareas`, alumno y tarea intactos | captura |
| 8 | Wallet no autorizada | Con otra wallet, crear un grupo propio y luego intentar escribir en "Grupo 402" de mi wallet | Rechazo (`NoOwner` o semillas), datos sin cambios | captura |
| 9 | El ID no se reutiliza | Tras la baja de #2, inscribir otro alumno | Recibe el ID #3 | [tx](PEGA_LINK) |

Los enlaces salen del botón **Ver transacción en Explorer** de la app (Devnet).

## Tecnologías

Rust + Anchor (programa), React + Vite + TypeScript (frontend), Wallet Adapter, Solana Kit, web3.js y Codama (cliente generado desde el IDL).

import type { Address } from "@solana/kit";

import {
  fetchAllAlumno,
  fetchAllTarea,
  fetchMaybeGrupo,
} from "../../clients/js/src/generated";
import { rpc } from "./conexion";
import { pdaGrupo } from "./pdas";

/*
LECTURAS: no necesitan wallet ni firma, solo el RPC.
El grupo guarda las direcciones de sus alumnos y cada alumno las de sus tareas,
asi que se lee nivel por nivel.
*/

export type TareaUI = { direccion: Address; clave: string; titulo: string; calificacion: number };

export type AlumnoUI = {
  direccion: Address;
  idAlumno: number;
  nombre: string;
  entregas: number;
  tareas: TareaUI[];
};

export type GrupoUI = {
  direccion: Address;
  nombreGrupo: string;
  idCounter: number;
  alumnos: AlumnoUI[];
};

export async function leerGrupo(nombreGrupo: string, owner: Address): Promise<GrupoUI | null> {
  const direccion = pdaGrupo(nombreGrupo, owner);
  const cuenta = await fetchMaybeGrupo(rpc, direccion);
  if (!cuenta.exists) return null;

  const alumnos = await fetchAllAlumno(rpc, cuenta.data.alumnos);

  const conTareas = await Promise.all(
    alumnos.map(async (a) => {
      const tareas = await fetchAllTarea(rpc, a.data.tareas);
      return {
        direccion: a.address,
        idAlumno: a.data.idAlumno,
        nombre: a.data.nombre,
        entregas: a.data.entregas,
        tareas: tareas.map((t) => ({
          direccion: t.address,
          clave: t.data.clave,
          titulo: t.data.titulo,
          calificacion: t.data.calificacion,
        })),
      };
    })
  );

  return {
    direccion,
    nombreGrupo: cuenta.data.nombreGrupo,
    idCounter: cuenta.data.idCounter,
    alumnos: conTareas,
  };
}

/*
El id del alumno nuevo lo asigna el programa (id_counter + 1), pero el id entra
en las semillas, asi que hay que conocer la direccion ANTES de firmar.
*/
export async function siguienteId(nombreGrupo: string, owner: Address): Promise<number> {
  const cuenta = await fetchMaybeGrupo(rpc, pdaGrupo(nombreGrupo, owner));
  if (!cuenta.exists) throw new Error("Ese grupo no existe todavia.");
  if (cuenta.data.alumnos.length >= 10) throw new Error("El grupo ya tiene 10 alumnos, el maximo previsto.");
  if (cuenta.data.idCounter >= 65_535) throw new Error("Se agotaron los identificadores u16 del grupo.");
  return cuenta.data.idCounter + 1;
}

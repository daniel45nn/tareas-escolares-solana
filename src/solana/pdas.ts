import { address, type Address } from "@solana/kit";
import { PublicKey } from "@solana/web3.js";

import { ESCUELA_PROGRAM_ADDRESS } from "../../clients/js/src/generated";
import { s } from "./seeds";

/*
DERIVACION DE PDAs

El Program ID sale del cliente generado, que a su vez lo saco de idl.json.
Cada funcion repite exactamente las semillas del programa Rust.
*/
const PROGRAM_ID = new PublicKey(ESCUELA_PROGRAM_ADDRESS);

function derivar(semillas: Buffer[]): Address {
  const [pda] = PublicKey.findProgramAddressSync(semillas, PROGRAM_ID);
  return address(pda.toBase58());
}

// Rust: seeds = [b"grupo", nombre_grupo.as_bytes(), owner.key().as_ref()]
export function pdaGrupo(nombreGrupo: string, owner: Address) {
  return derivar([s.texto("grupo"), s.texto(nombreGrupo), s.cuenta(owner)]);
}

// Rust: seeds = [b"alumno", grupo.key().as_ref(), id_alumno.to_le_bytes()]
export function pdaAlumno(grupo: Address, idAlumno: number) {
  return derivar([s.texto("alumno"), s.cuenta(grupo), s.u16(idAlumno)]);
}

// Rust: seeds = [b"tarea", alumno.key().as_ref(), clave.as_bytes()]
export function pdaTarea(alumno: Address, clave: string) {
  return derivar([s.texto("tarea"), s.cuenta(alumno), s.texto(clave)]);
}

/** Grupo, alumno y tarea de una sola vez: las operaciones de tarea necesitan las tres. */
export function cadena(nombreGrupo: string, owner: Address, idAlumno: number, clave: string) {
  const grupo = pdaGrupo(nombreGrupo, owner);
  const alumno = pdaAlumno(grupo, idAlumno);
  const tarea = pdaTarea(alumno, clave);
  return { grupo, alumno, tarea };
}

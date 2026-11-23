import { address, createNoopSigner, type Address } from '@solana/kit';
import type { Connection } from '@solana/web3.js';
import {
  getCrearGrupoInstruction, getInscribirAlumnoInstruction, getEntregarTareaInstruction,
  getCalificarTareaInstruction, getBorrarTareaInstruction, getDarBajaAlumnoInstruction,
} from '../../clients/js/src/generated';
import { cadena, pdaAlumno, pdaGrupo } from './pdas';
import { siguienteId } from './lecturas';
import { enviar, type WalletFirma, type OpcionesEnvio } from './tx';
import { comprobarConfiguracion } from './seguridad';
import { grupoValido, nombreValido, claveValida, tituloValido, idValido, calificacionValida } from './validaciones';

export function direccionDe(wallet: Pick<WalletFirma, 'publicKey'>): Address {
  if (!wallet.publicKey) throw new Error('Conecta tu wallet primero.');
  return address(wallet.publicKey.toBase58());
}

function firmante(wallet: WalletFirma) {
  comprobarConfiguracion();
  // Representa la identidad que la wallet firmará después; no contiene claves.
  return createNoopSigner(direccionDe(wallet));
}

/** Crear: la cuenta Grupo, con la wallet conectada como maestro. */
export async function crearGrupo(wallet: WalletFirma, connection: Connection, nombreGrupo: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  const owner = firmante(wallet);
  const grupo = pdaGrupo(nombreGrupo, owner.address);
  const ix = getCrearGrupoInstruction({ owner, grupo, nombreGrupo });
  return enviar(ix, wallet, connection, opciones);
}

/** Crear: un Alumno y su referencia en el Grupo. */
export async function inscribirAlumno(wallet: WalletFirma, connection: Connection, nombreGrupo: string, nombre: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  nombre = nombreValido(nombre);
  const owner = firmante(wallet);
  const grupo = pdaGrupo(nombreGrupo, owner.address);
  const id = await siguienteId(nombreGrupo, owner.address);
  const alumno = pdaAlumno(grupo, id);
  const ix = getInscribirAlumnoInstruction({ owner, grupo, alumno, nombre });
  return enviar(ix, wallet, connection, opciones);
}

/** Crear: una Tarea que depende del Alumno. */
export async function entregarTarea(wallet: WalletFirma, connection: Connection, nombreGrupo: string, idAlumno: number, clave: string, titulo: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  idAlumno = idValido(idAlumno);
  clave = claveValida(clave);
  titulo = tituloValido(titulo);
  const owner = firmante(wallet);
  const { grupo, alumno, tarea } = cadena(nombreGrupo, owner.address, idAlumno, clave);
  const ix = getEntregarTareaInstruction({ owner, grupo, alumno, tarea, idAlumno, clave, titulo });
  return enviar(ix, wallet, connection, opciones);
}

/** Modificar: la calificación de una Tarea existente (el programa exige 1 a 10). */
export async function calificarTarea(wallet: WalletFirma, connection: Connection, nombreGrupo: string, idAlumno: number, clave: string, calificacion: number, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  idAlumno = idValido(idAlumno);
  clave = claveValida(clave);
  calificacion = calificacionValida(calificacion);
  const owner = firmante(wallet);
  const { grupo, alumno, tarea } = cadena(nombreGrupo, owner.address, idAlumno, clave);
  const ix = getCalificarTareaInstruction({ owner, grupo, alumno, tarea, idAlumno, clave, calificacion });
  return enviar(ix, wallet, connection, opciones);
}

/** Cerrar: borra la Tarea y la quita de la lista del Alumno. */
export async function borrarTarea(wallet: WalletFirma, connection: Connection, nombreGrupo: string, idAlumno: number, clave: string, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  idAlumno = idValido(idAlumno);
  clave = claveValida(clave);
  const owner = firmante(wallet);
  const { grupo, alumno, tarea } = cadena(nombreGrupo, owner.address, idAlumno, clave);
  const ix = getBorrarTareaInstruction({ owner, grupo, alumno, tarea, idAlumno, clave });
  return enviar(ix, wallet, connection, opciones);
}

/** Cierre condicionado: baja de un Alumno sin tareas. Solo necesita el ID. */
export async function darBajaAlumno(wallet: WalletFirma, connection: Connection, nombreGrupo: string, idAlumno: number, opciones?: OpcionesEnvio): Promise<string> {
  nombreGrupo = grupoValido(nombreGrupo);
  idAlumno = idValido(idAlumno);
  const owner = firmante(wallet);
  const grupo = pdaGrupo(nombreGrupo, owner.address);
  const alumno = pdaAlumno(grupo, idAlumno);
  const ix = getDarBajaAlumnoInstruction({ owner, grupo, alumno, idAlumno });
  return enviar(ix, wallet, connection, opciones);
}

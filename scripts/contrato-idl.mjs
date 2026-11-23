import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';

export const REFERENCIA_ID = '38oTMyvUTmqkBQeMiuok5F2mPjp9dVadWdBeQTDNmTUY';
const normalizar = (valor) => String(valor).replace(/_/g, '').toLowerCase();
const requeridas = {
  creargrupo: ['nombregrupo'],
  inscribiralumno: ['nombre'],
  entregartarea: ['idalumno', 'clave', 'titulo'],
  calificartarea: ['idalumno', 'clave', 'calificacion'],
  borrartarea: ['idalumno', 'clave'],
  darbajaalumno: ['idalumno'],
};
const tiposArgumentos = {
  creargrupo: ['string'], inscribiralumno: ['string'],
  entregartarea: ['u16', 'string', 'string'],
  calificartarea: ['u16', 'string', 'u8'],
  borrartarea: ['u16', 'string'], darbajaalumno: ['u16'],
};
const camposEsperados = {
  grupo: [['owner', 'pubkey'], ['nombregrupo', 'string'], ['alumnos', 'vec:pubkey'], ['idcounter', 'u16']],
  alumno: [['idalumno', 'u16'], ['nombre', 'string'], ['entregas', 'u16'], ['tareas', 'vec:pubkey']],
  tarea: [['clave', 'string'], ['titulo', 'string'], ['calificacion', 'u8']],
};
const tipo = (valor) => typeof valor === 'string'
  ? (valor === 'publicKey' ? 'pubkey' : valor)
  : valor?.vec ? 'vec:' + tipo(valor.vec) : JSON.stringify(valor);

export function validarIdl(idl, programIdOpcional) {
  if (!idl || typeof idl !== 'object' || !Array.isArray(idl.instructions)) {
    throw new Error('El archivo no tiene la estructura de un IDL de Anchor.');
  }
  const nombres = idl.name ?? idl.metadata?.name;
  if (normalizar(nombres) !== 'escuela') {
    throw new Error('Este frontend espera el programa escuela (tareas escolares).');
  }
  for (const [nombre, argumentos] of Object.entries(requeridas)) {
    const instruccion = idl.instructions.find((item) => normalizar(item.name) === nombre);
    if (!instruccion || !Array.isArray(instruccion.args)) throw new Error('Falta la instruccion ' + nombre);
    const recibidos = instruccion.args.map((item) => normalizar(item.name));
    if (JSON.stringify(recibidos) !== JSON.stringify(argumentos)) {
      throw new Error('Los argumentos de ' + nombre + ' no coinciden con el programa de tareas.');
    }
    if (JSON.stringify(instruccion.args.map((item) => tipo(item.type))) !== JSON.stringify(tiposArgumentos[nombre])) {
      throw new Error('Los tipos de los argumentos de ' + nombre + ' no coinciden con el programa de tareas.');
    }
  }
  for (const cuenta of ['grupo', 'alumno', 'tarea']) {
    if (!idl.accounts?.some((item) => normalizar(item.name) === cuenta)) {
      throw new Error('Falta el tipo de cuenta ' + cuenta);
    }
    const definicion = idl.accounts.find((item) => normalizar(item.name) === cuenta).type
      ?? idl.types?.find((item) => normalizar(item.name) === cuenta)?.type;
    const campos = definicion?.fields?.map((item) => [normalizar(item.name), tipo(item.type)]);
    if (definicion?.kind !== 'struct' || JSON.stringify(campos) !== JSON.stringify(camposEsperados[cuenta])) {
      throw new Error('Los campos de la cuenta ' + cuenta + ' no coinciden con el programa de tareas.');
    }
  }
  const direccion = programIdOpcional ?? idl.address ?? idl.metadata?.address;
  if (!direccion) throw new Error('El IDL no incluye direccion. Agrega --program-id TU_PROGRAM_ID.');
  let programId;
  try { programId = new PublicKey(direccion).toBase58(); }
  catch { throw new Error('El Program ID no es una direccion valida de Solana.'); }
  if (programId === '11111111111111111111111111111111') {
    throw new Error('El System Program no es el programa de tareas. Usa el ID de tu despliegue.');
  }
  if (programIdOpcional && (idl.address ?? idl.metadata?.address) && programId !== (idl.address ?? idl.metadata?.address)) {
    throw new Error('El --program-id y la direccion del IDL no coinciden. Exporta el IDL correcto.');
  }
  return { programId, esReferencia: programId === REFERENCIA_ID };
}

export function prepararIdl(idl, programId) {
  const copia = structuredClone(idl);
  if (copia.address) copia.address = programId;
  else copia.metadata = { ...copia.metadata, address: programId };
  // El guion bajo de un argumento Rust no cambia sus bytes ni su posicion.
  // Normalizamos solo esos nombres para mantener idCliente en el cliente TS.
  for (const instruccion of copia.instructions) {
    for (const argumento of instruccion.args ?? []) argumento.name = argumento.name.replace(/^_+/, '');
  }
  return copia;
}

export function huellaIdl(idl) {
  return createHash('sha256').update(JSON.stringify(idl)).digest('hex');
}

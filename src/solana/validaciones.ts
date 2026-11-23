export function texto(valor: string, etiqueta: string, maxBytes: number): string {
  const limpio = valor.trim();
  if (!limpio) throw new Error(etiqueta + ' es obligatorio.');
  if (new TextEncoder().encode(limpio).length > maxBytes) {
    throw new Error(etiqueta + ' admite hasta ' + maxBytes + ' bytes UTF-8.');
  }
  return limpio;
}

export function entero(valor: number, etiqueta: string, minimo: number, maximo: number): number {
  if (!Number.isSafeInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(etiqueta + ' debe ser un entero entre ' + minimo + ' y ' + maximo + '.');
  }
  return valor;
}

export const grupoValido = (valor: string) => texto(valor, 'El nombre del grupo', 30);
export const nombreValido = (valor: string) => texto(valor, 'El nombre del alumno', 30);
export const claveValida = (valor: string) => texto(valor, 'La clave de la tarea', 5);
export const tituloValido = (valor: string) => texto(valor, 'El título', 50);
export const idValido = (valor: number) => entero(valor, 'El identificador', 1, 65_535);
// Solo comprueba que quepa en u8. La regla 1..10 la aplica el programa en Rust,
// así el rechazo se puede demostrar desde la app.
export const calificacionValida = (valor: number) => entero(valor, 'La calificación', 0, 255);

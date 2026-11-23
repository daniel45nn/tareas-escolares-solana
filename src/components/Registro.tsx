import { useEffect, useRef, useState } from 'react';
import { address } from '@solana/kit';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import programa from '../config/programa.json';
import { GRUPO_INICIAL } from '../config/interfaz';
import { leerGrupo, type GrupoUI } from '../solana/lecturas';
import { grupoValido } from '../solana/validaciones';
import { ErrorTransaccion, ErrorConfirmacionPendiente, enlaceTransaccion, traducir, type OpcionesEnvio } from '../solana/tx';
import { crearGrupo, inscribirAlumno, entregarTarea, calificarTarea, borrarTarea, darBajaAlumno } from '../solana/acciones';

type Operacion = 'grupo' | 'alumno' | 'tarea' | 'calificar' | 'borrar' | 'baja';
const operaciones: { id: Operacion; texto: string }[] = [
  { id: 'grupo', texto: 'Crear grupo' }, { id: 'alumno', texto: 'Inscribir alumno' },
  { id: 'tarea', texto: 'Entregar tarea' }, { id: 'calificar', texto: 'Calificar tarea' },
  { id: 'borrar', texto: 'Borrar tarea' }, { id: 'baja', texto: 'Baja de alumno' },
];

const textoCalificacion = (valor: number) => valor === 0 ? 'Sin calificar' : String(valor);

// El nombre del componente se conserva para no cambiar App.tsx; muestra los grupos.
export function Registro({ onCambio, onOcupado }: { onCambio: () => void; onOcupado: (valor: boolean) => void }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const walletDireccion = wallet.publicKey?.toBase58() ?? '';
  const [nombreGrupo, setNombreGrupo] = useState(GRUPO_INICIAL);
  const [maestro, setMaestro] = useState(walletDireccion);
  const [grupo, setGrupo] = useState<GrupoUI | null>(null);
  const [consultado, setConsultado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState('');
  const [op, setOp] = useState<Operacion>('grupo');
  const [nombre, setNombre] = useState('Ana López');
  const [idAlumno, setIdAlumno] = useState('1');
  const [clave, setClave] = useState('MAT01');
  const [titulo, setTitulo] = useState('Ejercicios de derivadas');
  const [calificacion, setCalificacion] = useState('9');
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState('');
  const [firma, setFirma] = useState('');
  const [firmaFallida, setFirmaFallida] = useState('');
  const [errorOperacion, setErrorOperacion] = useState('');
  const [aviso, setAviso] = useState('');
  const contexto = useRef('');
  const secuencia = useRef(0);
  contexto.current = nombreGrupo + '|' + maestro;

  useEffect(() => { setMaestro(walletDireccion); }, [walletDireccion]);
  useEffect(() => {
    secuencia.current += 1; setGrupo(null); setConsultado(false); setErrorLectura('');
    setLeyendo(false); setFirma(''); setFirmaFallida(''); setErrorOperacion(''); setAviso('');
  }, [nombreGrupo, maestro]);
  useEffect(() => { onOcupado(ocupado); return () => onOcupado(false); }, [ocupado, onOcupado]);

  async function cargar(nombre = nombreGrupo, owner = maestro) {
    const clave = nombre + '|' + owner;
    const turno = ++secuencia.current;
    setLeyendo(true); setErrorLectura('');
    try {
      const datos = await leerGrupo(grupoValido(nombre), address(owner.trim()));
      if (turno === secuencia.current && contexto.current === clave) { setGrupo(datos); setConsultado(true); }
    } catch (error) {
      if (turno === secuencia.current) setErrorLectura(traducir(error));
      throw error;
    } finally { if (turno === secuencia.current) setLeyendo(false); }
  }

  async function ejecutar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true); setFase('Preparando operación…'); setFirma(''); setFirmaFallida(''); setErrorOperacion(''); setAviso('');
    const grupoActual = nombreGrupo.trim();
    const direccionWallet = walletDireccion;
    const opciones: OpcionesEnvio = { onEstado: (estado) => setFase(estado === 'firma' ? 'Revisa la solicitud en tu wallet…' : 'Esperando confirmación de la red…') };
    try {
      const id = Number(idAlumno), nota = Number(calificacion);
      let resultado: string;
      switch (op) {
        case 'grupo': resultado = await crearGrupo(wallet, connection, grupoActual, opciones); break;
        case 'alumno': resultado = await inscribirAlumno(wallet, connection, grupoActual, nombre, opciones); break;
        case 'tarea': resultado = await entregarTarea(wallet, connection, grupoActual, id, clave, titulo, opciones); break;
        case 'calificar': resultado = await calificarTarea(wallet, connection, grupoActual, id, clave, nota, opciones); break;
        case 'borrar': resultado = await borrarTarea(wallet, connection, grupoActual, id, clave, opciones); break;
        case 'baja': resultado = await darBajaAlumno(wallet, connection, grupoActual, id, opciones); break;
      }
      setFirma(resultado); setFase('Operación confirmada correctamente.'); onCambio();
      try { await cargar(grupoActual, direccionWallet); }
      catch { setAviso('La operación se confirmó, pero no pudimos actualizar los datos. Pulsa Consultar grupo para volver a leerlos.'); }
    } catch (error) {
      setFase(''); setErrorOperacion(traducir(error));
      if (error instanceof ErrorTransaccion || error instanceof ErrorConfirmacionPendiente) setFirmaFallida(error.firma);
    } finally { setOcupado(false); }
  }

  const esOtroMaestro = !!maestro.trim() && maestro.trim() !== walletDireccion;
  const permiteEscribir = !programa.esReferencia && !!wallet.publicKey && !esOtroMaestro;
  const usaTarea = op === 'tarea' || op === 'calificar' || op === 'borrar';
  return <>
    <div className="section-heading"><div><p className="eyebrow">GRUPO · ALUMNOS · TAREAS</p><h2>Tus grupos y tareas</h2></div><span className="tag">Cuentas PDA en Devnet</span></div>
    {programa.esReferencia && <aside className="notice information"><strong>Configura tu programa para comenzar.</strong><p>La aplicación trae un IDL de referencia. Importa el IDL exportado de tu despliegue en Playground para consultar grupos y hacer operaciones.</p></aside>}
    <section className="panel lookup-panel">
      <div className="panel-heading"><h3>Buscar un grupo</h3><span className="small-note">Lectura sin firma</span></div>
      <div className="lookup-fields"><label>Nombre exacto del grupo<input value={nombreGrupo} disabled={ocupado} onChange={(e) => setNombreGrupo(e.target.value)} placeholder="Grupo 402" /></label>
      <label>Dirección del maestro<input value={maestro} disabled={ocupado} onChange={(e) => setMaestro(e.target.value)} placeholder="Conecta tu wallet o pega una dirección pública" spellCheck={false} autoComplete="off" /></label>
      <button className="button secondary" disabled={leyendo || ocupado || programa.esReferencia || !nombreGrupo.trim() || !maestro.trim()} onClick={() => void cargar().catch(() => {})}>{leyendo ? 'Consultando…' : 'Consultar grupo'}</button></div>
      <p className="help">El nombre del grupo y la wallet del maestro determinan la dirección del grupo.</p>
      {errorLectura && <p className="notice error" role="alert">{errorLectura}</p>}
    </section>
    <div className="workspace-grid">
      <section className="panel customers-panel"><div className="panel-heading"><h3>Alumnos y tareas</h3>{grupo && <span className="count">{grupo.alumnos.length} alumnos</span>}</div>
        {!grupo ? <div className="empty-state"><span className="empty-symbol">◎</span><h4>{consultado ? 'El grupo todavía no existe' : 'El grupo aparecerá aquí'}</h4><p>{consultado ? 'Revisa el nombre y el maestro, o crea el grupo con tu wallet conectada.' : 'Consulta el grupo para ver a sus alumnos y sus tareas.'}</p></div> : <>
          <div className="registry-summary"><div><span className="label">Grupo</span><strong>{grupo.nombreGrupo}</strong></div><div><span className="label">Último ID asignado</span><strong>{grupo.idCounter}</strong></div></div>
          <details className="technical-details"><summary>Dirección del grupo</summary><code className="address">{grupo.direccion}</code></details>
          {grupo.alumnos.length === 0 ? <p className="empty-line">Todavía no hay alumnos. Inscribe el primero desde Operaciones.</p> : grupo.alumnos.map((alumno) => <article className="customer" key={alumno.direccion}>
            <header><div><strong>{alumno.nombre}</strong><span className="small-note">Alumno #{alumno.idAlumno} · {alumno.entregas} tareas</span></div><button className="text-button" disabled={ocupado} onClick={() => { setIdAlumno(String(alumno.idAlumno)); setOp('tarea'); }}>Seleccionar</button></header>
            {alumno.tareas.length === 0 ? <p className="empty-line">Sin tareas entregadas.</p> : <div className="table-wrap"><table><thead><tr><th>Clave</th><th>Título</th><th className="numeric">Calificación</th></tr></thead><tbody>{alumno.tareas.map((tarea) => <tr key={tarea.direccion} onClick={() => { if (!ocupado) { setIdAlumno(String(alumno.idAlumno)); setClave(tarea.clave); setOp('calificar'); } }}><td><code>{tarea.clave}</code></td><td>{tarea.titulo}</td><td className="numeric">{textoCalificacion(tarea.calificacion)}</td></tr>)}</tbody></table></div>}
          </article>)}
        </>}
      </section>
      <section className="panel operations-panel"><div className="panel-heading"><h3>Operaciones</h3><span className="small-note">Con firma del maestro</span></div>
        <div className="operation-tabs">{operaciones.map((item) => <button key={item.id} className={op === item.id ? 'active' : ''} disabled={ocupado} onClick={() => { setOp(item.id); setFirma(''); setErrorOperacion(''); setFirmaFallida(''); setFase(''); }}>{item.texto}</button>)}</div>
        <form onSubmit={ejecutar}>
          <fieldset disabled={ocupado || !permiteEscribir}>
            {op === 'grupo' && <p className="help">Crearás el grupo <strong>{nombreGrupo || 'tu grupo'}</strong> con la wallet conectada como maestro.</p>}
            {op === 'alumno' && <label>Nombre del alumno<input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label>}
            {usaTarea && <div className="two-fields"><label>ID del alumno<input type="number" min="1" max="65535" step="1" value={idAlumno} onChange={(e) => setIdAlumno(e.target.value)} required /></label><label>Clave de la tarea<input value={clave} onChange={(e) => setClave(e.target.value)} required /></label></div>}
            {op === 'baja' && <label>ID del alumno<input type="number" min="1" max="65535" step="1" value={idAlumno} onChange={(e) => setIdAlumno(e.target.value)} required /></label>}
            {op === 'tarea' && <label>Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required /></label>}
            {op === 'calificar' && <label>Calificación<input type="number" min="0" max="255" step="1" value={calificacion} onChange={(e) => setCalificacion(e.target.value)} required /><span className="help">Regla del programa: de 1 a 10. Otro valor se rechaza en Rust.</span></label>}
            {op === 'borrar' && <p className="notice subtle">Cierra la cuenta de la tarea y la quita de la lista del alumno.</p>}
            {op === 'baja' && <p className="notice subtle">Cierra la cuenta del alumno. El programa la rechaza si el alumno todavía tiene tareas. Su ID no se reutiliza.</p>}
            <button className="button primary" type="submit" disabled={!nombreGrupo.trim()}>{ocupado ? 'Operación en curso…' : operaciones.find((item) => item.id === op)!.texto}</button>
          </fieldset>
        </form>
        {!wallet.publicKey && <p className="help">Conecta tu wallet de Devnet para hacer operaciones.</p>}
        {esOtroMaestro && wallet.publicKey && <p className="notice subtle">Estás viendo el grupo de otro maestro. Para escribir, usa un grupo de la wallet conectada.</p>}
        {ocupado && <p className="notice information" role="status">{fase}</p>}
        {firma && <p className="notice success" role="status"><strong>Operación confirmada.</strong><br/><a href={enlaceTransaccion(firma)} target="_blank" rel="noreferrer">Ver transacción en Explorer</a></p>}
        {errorOperacion && <p className="notice error" role="alert">{errorOperacion}{firmaFallida && <><br/><a href={enlaceTransaccion(firmaFallida)} target="_blank" rel="noreferrer">Revisar transacción en Explorer</a></>}</p>}
        {aviso && <p className="notice subtle">{aviso}</p>}
      </section>
    </div>
  </>;
}

use anchor_lang::prelude::*;

// Playground llena esta direccion al hacer Build por primera vez.
declare_id!("");

/*
TAREAS ESCOLARES EN SOLANA

Un maestro (owner) crea un Grupo, inscribe Alumnos y registra las Tareas que
entrega cada alumno. Cada entidad vive en su propia cuenta PDA:

    grupo   <- [b"grupo",  nombre_grupo, owner]
    alumno  <- [b"alumno", grupo,  id_alumno]
    tarea   <- [b"tarea",  alumno, clave]

Como cada cuenta se deriva de su padre, la pertenencia queda garantizada por
las semillas: si la direccion coincide, el alumno ES de ese grupo y la tarea
ES de ese alumno. "has_one = owner" asegura que solo el maestro escribe.
*/

/// Regla de negocio: las calificaciones van de 1 a 10. 0 significa "sin calificar".
pub const CALIFICACION_MINIMA: u8 = 1;
pub const CALIFICACION_MAXIMA: u8 = 10;

#[program]
pub mod escuela {
    use super::*;

    /////////////////////////// Crear Grupo ///////////////////////////
    pub fn crear_grupo(context: Context<NuevoGrupo>, nombre_grupo: String) -> Result<()> {
        context.accounts.grupo.set_inner(Grupo {
            owner: context.accounts.owner.key(), // el maestro que firma
            nombre_grupo: nombre_grupo.clone(),
            alumnos: Vec::new(), // guarda PDAs de alumnos, no sus datos
            id_counter: 0,       // asigna un id unico a cada alumno
        });

        msg!("Grupo {} creado", nombre_grupo);
        Ok(())
    }

    /////////////////////////// Inscribir Alumno ///////////////////////////
    pub fn inscribir_alumno(context: Context<NuevoAlumno>, nombre: String) -> Result<()> {
        let alumno_key = context.accounts.alumno.key(); // se lee antes del &mut

        let grupo = &mut context.accounts.grupo;
        let id_alumno = grupo.id_counter + 1; // el programa asigna el id
        grupo.id_counter = id_alumno;
        grupo.alumnos.push(alumno_key);

        context.accounts.alumno.set_inner(Alumno {
            id_alumno,
            nombre: nombre.clone(),
            entregas: 0,
            tareas: Vec::new(),
        });

        msg!("Alumno {} inscrito con id: {}", nombre, id_alumno);
        Ok(())
    }

    /////////////////////////// Entregar Tarea ///////////////////////////
    // La tarea nace sin calificar (calificacion = 0).
    pub fn entregar_tarea(
        context: Context<NuevaTarea>,
        _id_alumno: u16,
        clave: String,
        titulo: String,
    ) -> Result<()> {
        context.accounts.tarea.set_inner(Tarea {
            clave,
            titulo,
            calificacion: 0,
        });

        let tarea_key = context.accounts.tarea.key();
        let alumno = &mut context.accounts.alumno;
        alumno.tareas.push(tarea_key);
        alumno.entregas += 1;

        msg!("Tarea entregada por el alumno con id: {}", alumno.id_alumno);
        Ok(())
    }

    /////////////////////////// Calificar Tarea ///////////////////////////
    // Modifica una cuenta existente. Regla: la calificacion debe ir de 1 a 10.
    pub fn calificar_tarea(
        context: Context<ModificarTarea>,
        _id_alumno: u16,
        clave: String,
        calificacion: u8,
    ) -> Result<()> {
        require!(
            calificacion >= CALIFICACION_MINIMA && calificacion <= CALIFICACION_MAXIMA,
            Errores::CalificacionInvalida
        );

        let tarea = &mut context.accounts.tarea;
        let anterior = tarea.calificacion;
        tarea.calificacion = calificacion;

        msg!(
            "Tarea {} calificada: de {} a {}",
            clave,
            anterior,
            calificacion
        );
        Ok(())
    }

    /////////////////////////// Borrar Tarea ///////////////////////////
    // Cierra la cuenta de la tarea ("close = owner") y la quita del alumno.
    pub fn borrar_tarea(context: Context<EliminarTarea>, _id_alumno: u16, clave: String) -> Result<()> {
        let tarea_key = context.accounts.tarea.key();
        let alumno = &mut context.accounts.alumno;

        require!(alumno.tareas.contains(&tarea_key), Errores::TareaNoEncontrada);

        alumno.tareas.retain(|&k| k != tarea_key);
        alumno.entregas -= 1;

        msg!("Tarea {} borrada del alumno con id: {}", clave, alumno.id_alumno);
        Ok(())
    }

    /////////////////////////// Dar de Baja Alumno ///////////////////////////
    // Cierre CONDICIONADO: solo se puede dar de baja a un alumno sin tareas.
    // El id_counter del grupo no retrocede: el id liberado no se reutiliza.
    pub fn dar_baja_alumno(context: Context<EliminarAlumno>, _id_alumno: u16) -> Result<()> {
        let alumno_key = context.accounts.alumno.key();

        let sin_tareas =
            context.accounts.alumno.tareas.is_empty() && context.accounts.alumno.entregas == 0;
        require!(sin_tareas, Errores::AlumnoConTareas);

        let id_alumno = context.accounts.alumno.id_alumno;
        let grupo = &mut context.accounts.grupo;

        require!(grupo.alumnos.contains(&alumno_key), Errores::AlumnoNoInscrito);
        grupo.alumnos.retain(|&k| k != alumno_key);

        msg!("Alumno con id: {} dado de baja", id_alumno);
        Ok(())
    }
}

/////////////////////////// Codigos de Error ///////////////////////////
#[error_code]
pub enum Errores {
    #[msg("Error, no eres el maestro de este grupo")]
    NoOwner, // 6000
    #[msg("Error, la tarea no esta en la lista del alumno")]
    TareaNoEncontrada, // 6001
    #[msg("Error, el alumno todavia tiene tareas")]
    AlumnoConTareas, // 6002
    #[msg("Error, el alumno no esta inscrito en el grupo")]
    AlumnoNoInscrito, // 6003
    #[msg("Error, la calificacion debe estar entre 1 y 10")]
    CalificacionInvalida, // 6004
}

/////////////////////////// CUENTAS ///////////////////////////

#[account]
#[derive(InitSpace)]
pub struct Grupo {
    pub owner: Pubkey, // pub: has_one = owner lo necesita

    #[max_len(30)]
    nombre_grupo: String,

    #[max_len(10)] // hasta 10 alumnos por grupo
    alumnos: Vec<Pubkey>,

    id_counter: u16,
}

#[account]
#[derive(InitSpace)]
pub struct Alumno {
    id_alumno: u16,

    #[max_len(30)]
    nombre: String,

    entregas: u16,

    #[max_len(10)] // hasta 10 tareas por alumno
    tareas: Vec<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct Tarea {
    #[max_len(5)] // clave corta, por ejemplo MAT01
    clave: String,

    #[max_len(50)]
    titulo: String,

    calificacion: u8, // 0 = sin calificar, 1..=10 = calificada
}

/////////////////////////// CONTEXTOS ///////////////////////////

#[derive(Accounts)]
#[instruction(nombre_grupo: String)]
pub struct NuevoGrupo<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Grupo::INIT_SPACE + 8,
        seeds = [b"grupo", nombre_grupo.as_bytes(), owner.key().as_ref()],
        bump
    )]
    pub grupo: Account<'info, Grupo>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct NuevoAlumno<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ Errores::NoOwner)]
    pub grupo: Account<'info, Grupo>,

    #[account(
        init,
        payer = owner,
        space = Alumno::INIT_SPACE + 8,
        seeds = [b"alumno", grupo.key().as_ref(), (grupo.id_counter + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub alumno: Account<'info, Alumno>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id_alumno: u16, clave: String)]
pub struct NuevaTarea<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub grupo: Account<'info, Grupo>,

    #[account(
        mut,
        seeds = [b"alumno", grupo.key().as_ref(), id_alumno.to_le_bytes().as_ref()],
        bump
    )]
    pub alumno: Account<'info, Alumno>,

    #[account(
        init,
        payer = owner,
        space = Tarea::INIT_SPACE + 8,
        // la clave entra en las semillas: un alumno no repite la misma tarea
        seeds = [b"tarea", alumno.key().as_ref(), clave.as_bytes()],
        bump
    )]
    pub tarea: Account<'info, Tarea>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id_alumno: u16, clave: String)]
pub struct ModificarTarea<'info> {
    pub owner: Signer<'info>,

    #[account(has_one = owner @ Errores::NoOwner)]
    pub grupo: Account<'info, Grupo>,

    #[account(
        seeds = [b"alumno", grupo.key().as_ref(), id_alumno.to_le_bytes().as_ref()],
        bump
    )]
    pub alumno: Account<'info, Alumno>,

    #[account(
        mut,
        seeds = [b"tarea", alumno.key().as_ref(), clave.as_bytes()],
        bump
    )]
    pub tarea: Account<'info, Tarea>,
}

#[derive(Accounts)]
#[instruction(id_alumno: u16, clave: String)]
pub struct EliminarTarea<'info> {
    #[account(mut)]
    pub owner: Signer<'info>, // recibe el rent de la tarea cerrada

    #[account(has_one = owner @ Errores::NoOwner)]
    pub grupo: Account<'info, Grupo>,

    #[account(
        mut,
        seeds = [b"alumno", grupo.key().as_ref(), id_alumno.to_le_bytes().as_ref()],
        bump
    )]
    pub alumno: Account<'info, Alumno>,

    #[account(
        mut,
        close = owner,
        seeds = [b"tarea", alumno.key().as_ref(), clave.as_bytes()],
        bump
    )]
    pub tarea: Account<'info, Tarea>,
}

#[derive(Accounts)]
#[instruction(id_alumno: u16)]
pub struct EliminarAlumno<'info> {
    #[account(mut)]
    pub owner: Signer<'info>, // recibe el rent del alumno cerrado

    #[account(mut, has_one = owner @ Errores::NoOwner)]
    pub grupo: Account<'info, Grupo>,

    #[account(
        mut,
        close = owner,
        seeds = [b"alumno", grupo.key().as_ref(), id_alumno.to_le_bytes().as_ref()],
        bump
    )]
    pub alumno: Account<'info, Alumno>,
}

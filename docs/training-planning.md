# Planificación de entrenamiento

## Alcance

El módulo de entrenamiento permite administrar, por gimnasio:

- objetivos principales y secundarios del socio, con notas e historial de estados;
- biblioteca de ejercicios editable, con activación y pausa;
- rutinas ordenadas por día y ejercicio, con series, repeticiones, peso sugerido, descanso, tiempo y notas;
- planes progresivos compuestos por fases semanales y rutinas reutilizables;
- asignaciones de un plan o una rutina a un socio, con pausa, reactivación, finalización e historial.

## Reglas operativas

- Todo ID se vuelve a validar en servidor contra el gimnasio activo.
- Un entrenador sólo puede consultar objetivos y asignaciones de sus socios.
- Un entrenador sólo puede editar o archivar rutinas que le pertenecen; las rutinas de la biblioteca pueden duplicarse para crear una copia propia.
- Crear una asignación cierra como `reemplazada` cualquier asignación activa anterior del socio.
- Los objetivos, planes, rutinas, ejercicios y asignaciones se archivan o cambian de estado; no se eliminan desde la interfaz.
- Los cambios sensibles generan eventos de auditoría.

## Fase vigente

La semana se calcula desde `AsignacionEntrenamiento.fechaInicio`. El portal del socio selecciona únicamente la rutina de la fase cuyo rango incluye esa semana. La misma fase se muestra en el panel de asignaciones para que entrenador y socio vean un resultado consistente.

## Migración

`2026083102_training_planning` agrega a los objetivos un estado explícito, fecha de finalización y fecha de actualización. En entornos desplegados se aplica con `npm run db:deploy`; no se debe usar sincronización destructiva del esquema.

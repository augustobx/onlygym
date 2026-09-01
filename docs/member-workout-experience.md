# Experiencia de entrenamiento del socio

## Entrenamiento de hoy

El portal resuelve en servidor la asignación activa, la fase vigente del plan y el próximo día de la rutina. Una rutina de varios días muestra y ejecuta solamente los ejercicios correspondientes al día calculado.

Antes de comenzar se muestran ejercicios, series, repeticiones, peso sugerido, descanso, tiempo y recomendaciones. La sesión activa presenta un ejercicio por vez para facilitar el uso con una sola mano.

## Registro durante la sesión

Por serie se puede guardar:

- peso y repeticiones;
- realizada o pendiente;
- esfuerzo percibido de 1 a 10;
- comentario opcional.

Al completar una serie se inicia el descanso indicado por el entrenador. El socio puede omitirlo, avanzar o volver entre ejercicios y ver el porcentaje total completado.

Al finalizar se guardan duración, cumplimiento, comentario general y puntos. La finalización se procesa en una transacción serializable para evitar cierres o premios duplicados.

## Integridad histórica

Cada sesión conserva una copia de la prescripción usada en ese momento: día, series, repeticiones objetivo, peso sugerido, descanso, tiempo y observaciones. Los cambios posteriores sobre la plantilla de rutina no reescriben el historial.

## Historial y cargas

La sección Progreso muestra hasta 30 sesiones con detalle por ejercicio y serie. La progresión de cargas usa el peso máximo completado en cada sesión y presenta una visualización simple por ejercicio.

Todas las consultas se limitan al gimnasio y al socio obtenidos desde la sesión autenticada; el navegador no determina esos identificadores.

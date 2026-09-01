-- Snapshot the prescribed workout so history remains stable after routine edits.
ALTER TABLE "sesiones_entrenamiento"
ADD COLUMN "dia_rutina" INTEGER;

ALTER TABLE "ejercicios_sesion"
ADD COLUMN "series_objetivo" INTEGER,
ADD COLUMN "repeticiones_objetivo" VARCHAR(30),
ADD COLUMN "peso_sugerido" DECIMAL(8,2),
ADD COLUMN "descanso_segundos" INTEGER,
ADD COLUMN "tiempo_segundos" INTEGER;

# ADR 016: Gestión de Acciones en Recomendaciones de Alertas

## Estado
Aceptado

## Contexto
El sistema debe permitir que los usuarios no solo reciban sugerencias de palabras clave (RF05), sino que tengan el control manual sobre cuáles incorporar a su perfil de alerta (RF06). Además, se detectó la necesidad de centralizar la lógica de creación y edición en un único componente modal para mantener la consistencia.

## Decisión
1. **Lógica de Chips en Frontend:** Se implementa un estado local para las recomendaciones que se sincroniza con el input de descriptores. Al aceptar una sugerencia, se realiza una manipulación de strings para mantener el formato separado por comas.
2. **Filtrado en Cliente:** Para evitar redundancia, el frontend filtra las sugerencias del backend comparándolas con las palabras ya aceptadas antes de renderizar.
3. **Persistencia:** Se decidió separar la lógica de "Sugerir" (lectura) de la de "Guardar" (escritura) para reducir llamadas innecesarias a la API durante la edición.
4. **Manejo de Concurrencia en Backend:** Se permite el solapamiento controlado de tareas de monitorización (`max_instances=3`) para evitar saltos en el cronograma cuando el volumen de noticias es alto.

## Consecuencias
- **Positivas:** Mejora significativa en la experiencia de usuario (UX). Reducción de ruido visual en la terminal del servidor.
- **Negativas:** El componente `AlertForm` aumenta su complejidad al manejar dos modos (Creación/Edición).
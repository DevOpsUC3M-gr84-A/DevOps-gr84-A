# Frontend NewsRadar — Vite dev server containerizado.
# Servimos la app con `vite` (modo dev) escuchando en 0.0.0.0:5173 para que
# el host pueda alcanzarla. Se elige modo dev en lugar de build estático para
# evitar el `base: /DevOps-gr84-A/` que vite.config.ts aplica en `command==='build'`
# (orientado a GitHub Pages) y mantener la app accesible en la raíz `/`.
FROM node:20-alpine

WORKDIR /app

# Instalación de dependencias en una capa cacheable.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Código de la aplicación.
COPY . .

ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173

# --host expone el dev server fuera del contenedor; --strictPort hace fallar
# rápido si el 5173 ya está ocupado, en lugar de saltar a otro puerto.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

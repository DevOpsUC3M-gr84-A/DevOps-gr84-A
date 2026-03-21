# 1. Imagen base de Python
FROM python:3.11-slim

# 2. Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiamos el archivo de dependencias (requirements.txt)
COPY requirements.txt .

# 4. Instalamos los paquetes necesarios
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiamos el código fuente de la app a la ruta del contenedor
COPY ./app ./app

# 6. Exponemos el puerto que usará FastAPI para comunicarse
EXPOSE 8000

# 7. Ejecutamos el archivo principal (API REST) mediante Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
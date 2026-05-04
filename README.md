# DevOps-gr84-A / NewsRadar

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue.svg)](https://github.com/features/actions)
[![Quality Gate](https://img.shields.io/badge/SonarQube-Passed_A-success.svg)](https://sonarqube.org/)
[![Coverage](https://img.shields.io/badge/Coverage->80%25-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sistema avanzado de monitorización de noticias en medios de comunicación y fuentes oficiales.

Proyecto final de la asignatura Desarrollo y Operación de Sistemas Software (UC3M, Grado en Ingeniería Informática).

## Índice
- [Descripción](#descripción)
- [Inicio rápido](#inicio-rápido)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [API REST](#api-rest)
- [Tests y calidad](#tests-y-calidad)
- [Documentación](#documentación)
- [Trazabilidad](#trazabilidad)

## Descripción
**NewsRadar** permite escuchar canales RSS de medios de comunicación y fuentes oficiales, organizar la información en categorías IPTC, y monitorizar palabras clave mediante alertas configurables. Cuando se detecta una noticia que coincide con una alerta, el sistema notifica al usuario por correo electrónico y mediante un buzón interno interactivo en tiempo real. 

El sistema destaca por su arquitectura resiliente, con agentes tolerantes a fallos y mecanismos de deduplicación de base de datos.

## Inicio rápido
```bash
git clone [https://github.com/tu-usuario/DevOps-gr84-A.git](https://github.com/tu-usuario/DevOps-gr84-A.git)
cd DevOps-gr84-A

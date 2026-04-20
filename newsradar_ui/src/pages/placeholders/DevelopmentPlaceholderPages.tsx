import React from 'react';

interface DevelopmentPlaceholderPageProps {
  title: string;
  summary: string;
}

const DevelopmentPlaceholderPage = ({ title, summary }: DevelopmentPlaceholderPageProps) => (
  <main className="main-content" aria-labelledby="placeholder-title">
    <header className="header-actions">
      <h2 id="placeholder-title">{title}</h2>
    </header>

    <section className="table-container" aria-label={`${title} en desarrollo`}>
      <p>{summary}</p>
      <p>
        Esta vista ya está integrada en la navegación principal y mantiene la estructura base
        para cumplir el objetivo funcional mientras se implementa el contenido definitivo.
      </p>
    </section>
  </main>
);

export const DashboardDevelopmentPage = () => (
  <DevelopmentPlaceholderPage
    title="Dashboard / Resumen"
    summary="Aquí se mostrarán las nubes de palabras y el resumen de estadísticas de actividad."
  />
);

export const SourcesRssDevelopmentPage = () => (
  <DevelopmentPlaceholderPage
    title="Gestión de Fuentes y canales RSS"
    summary="Aquí se gestionarán los medios, fuentes y canales RSS monitorizados por el sistema."
  />
);

export const NotificationsDevelopmentPage = () => (
  <DevelopmentPlaceholderPage
    title="Buzón de Notificaciones"
    summary="Aquí aparecerán las notificaciones generadas por alertas y eventos relevantes."
  />
);

export const ProfileDevelopmentPage = () => (
  <DevelopmentPlaceholderPage
    title="Gestión del Perfil de Usuario"
    summary="Aquí se centralizarán las opciones de perfil, preferencias y configuración personal."
  />
);

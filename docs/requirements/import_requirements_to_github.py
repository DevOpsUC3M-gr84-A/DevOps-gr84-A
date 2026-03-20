import csv
import requests
import datetime
import os
from collections import defaultdict

# CONFIGURACIÓN DE GITHUB
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = "DevOpsUC3M-gr84-A"
REPO_NAME = "DevOps-gr84-A"
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}
BASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"

# --- CONFIGURACIÓN DE SCRUM ---
DIAS_POR_SPRINT = 14  # Duración de cada sprint en días

def obtener_o_crear_milestone(titulo, descripcion, due_date):
    url = f"{BASE_URL}/milestones"
    
    # 1. Buscamos si el Milestone ya existe
    response_get = requests.get(url, headers=HEADERS)
    if response_get.status_code == 200:
        milestones_existentes = response_get.json()
        for ms in milestones_existentes:
            if ms["title"] == titulo:
                print(f"✅ Milestone recuperado (ya existía): {titulo}")
                return ms["number"]

    # 2. Si no existe, lo creamos
    data = {
        "title": titulo,
        "description": descripcion,
        "due_on": due_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    response_post = requests.post(url, headers=HEADERS, json=data)
    
    if response_post.status_code == 201:
        print(f"✅ Milestone creado: {titulo}")
        return response_post.json()["number"]
    else:
        print(f"❌ Error al crear milestone {titulo}: {response_post.text}")
        return None

def crear_issue(titulo, descripcion, etiquetas, milestone_id):
    url = f"{BASE_URL}/issues"
    data = {
        "title": titulo,
        "body": descripcion,
        "labels": etiquetas,
        "milestone": milestone_id,
    }
    response = requests.post(url, headers=HEADERS, json=data)
    if response.status_code == 201:
        print(f"  -> Issue creado: {titulo}")
    else:
        print(f"  -> ❌ Error al crear issue {titulo}: {response.text}")

# --- LÓGICA PRINCIPAL ---
def main():
    # Usamos un diccionario para agrupar los requisitos por número de sprint
    sprints = defaultdict(list)

    # 1. Leer el CSV
    try:
        with open("requirements.csv", mode="r", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                # Si no tiene columna sprint, lo mandamos al sprint 1 por defecto
                num_sprint = int(row.get("sprint", 1))
                sprints[num_sprint].append(row)
    except FileNotFoundError:
        print("❌ Archivo requirements.csv no encontrado.")
        return

    # 2. Crear Milestones y luego los Issues en GitHub
    fecha_inicio = datetime.datetime.now()

    # Ordenamos los sprints (1, 2, 3, 4)
    for num_sprint in sorted(sprints.keys()):
        sprint_reqs = sprints[num_sprint]
        fecha_fin = fecha_inicio + datetime.timedelta(days=DIAS_POR_SPRINT * num_sprint)

        print(f"\n🚀 Procesando Sprint {num_sprint}...")

        milestone_id = obtener_o_crear_milestone(
            titulo=f"Sprint {num_sprint}",
            descripcion=f"Fase {num_sprint} del desarrollo de NEWSRADAR.",
            due_date=fecha_fin,
        )

        if not milestone_id:
            continue

        # Crear los issues y meterlos en el milestone
        for req in sprint_reqs:
            req_id = req.get("id", "??")
            titulo_csv = req.get("titulo", "Sin título")
            
            titulo_issue = f"[{req_id}] {titulo_csv}"
            # Quitamos la estimación de 5h falsa, dejamos solo prioridad y bloque
            body = f"{req.get('descripcion', '')}\n\n**Bloque:** {req.get('bloque', '')}\n**Prioridad:** {req.get('prioridad', '')}"

            etiquetas = [req.get("tipo", "enhancement").strip()]
            labels_extra = req.get("labels", "")
            if labels_extra:
                for label in labels_extra.split(","):
                    etiquetas.append(label.strip())

            # Eliminamos etiquetas duplicadas
            etiquetas = list(set(etiquetas))

            crear_issue(titulo_issue, body, etiquetas, milestone_id)

if __name__ == "__main__":
    main()
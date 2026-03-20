import requests
import os

# CONFIGURACIÓN DE GITHUB
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = "bherranz"
REPO_NAME = "DevOps-gr84-A"
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}
BASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"

def cerrar_todos_los_issues():
    print("Buscando issues abiertos...")
    url = f"{BASE_URL}/issues?state=open&per_page=100"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 200:
        issues = response.json()
        if not issues:
            print("✅ No hay issues abiertos.")
            return

        for issue in issues:
            # La API devuelve PRs como issues, los saltamos
            if "pull_request" not in issue:
                issue_num = issue["number"]
                patch_url = f"{BASE_URL}/issues/{issue_num}"
                res = requests.patch(patch_url, headers=HEADERS, json={"state": "closed"})
                if res.status_code == 200:
                    print(f" -> 🔒 Issue #{issue_num} cerrado correctamente.")
                else:
                    print(f" -> ❌ Error al cerrar issue #{issue_num}: {res.text}")
    else:
        print(f"❌ Error al obtener issues: {response.text}")

def eliminar_todos_los_milestones():
    print("\nBuscando milestones abiertos...")
    url = f"{BASE_URL}/milestones?state=open&per_page=100"
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 200:
        milestones = response.json()
        if not milestones:
            print("✅ No hay milestones abiertos.")
            return

        for ms in milestones:
            ms_num = ms["number"]
            del_url = f"{BASE_URL}/milestones/{ms_num}"
            res = requests.delete(del_url, headers=HEADERS)
            if res.status_code == 204:
                print(f" -> 🗑️ Milestone '{ms['title']}' eliminado correctamente.")
            else:
                print(f" -> ❌ Error al eliminar milestone '{ms['title']}': {res.text}")
    else:
        print(f"❌ Error al obtener milestones: {response.text}")

if __name__ == "__main__":
    cerrar_todos_los_issues()
    eliminar_todos_los_milestones()
    print("\n✨ ¡Limpieza completada! Tu repositorio está listo para empezar de cero.")
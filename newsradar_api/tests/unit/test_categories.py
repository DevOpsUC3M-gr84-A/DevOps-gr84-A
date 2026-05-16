import pytest


@pytest.mark.unit
def test_list_iptc_categories_ok(api_client, auth_headers):
    response = api_client.get("/api/v1/iptc-categories", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) > 0


@pytest.mark.unit
def test_iptc_categories_have_code_and_label(api_client, auth_headers):
    response = api_client.get("/api/v1/iptc-categories", headers=auth_headers)
    first = response.json()[0]
    assert "code" in first
    assert "label" in first


@pytest.mark.unit
def test_list_categories_requires_auth(api_client_no_auth):
    response = api_client_no_auth.get("/api/v1/categories")
    assert response.status_code == 401


@pytest.mark.unit
def test_list_categories_returns_list(api_client, auth_headers):
    response = api_client.get("/api/v1/categories", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.unit
def test_create_category_minimal(api_client, auth_headers):
    payload = {"name": "Política", "source": "IPTC"}
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    # La categoría ya existe en la semilla; la API responde 409 Conflict
    assert response.status_code == 409


@pytest.mark.unit
def test_create_category_uses_explicit_id_when_name_is_not_iptc(api_client, auth_headers):
    """Tras GC-008, un nombre que no pertenece al catálogo IPTC ya nunca crea
    una categoría libre: la API devuelve 422 aunque se mande un id explícito."""
    payload = {
        "id": 1000000,
        "name": "Categoría personalizada",
        "source": "IPTC",
    }
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_create_category_with_valid_iptc_code(api_client, auth_headers):
    """GC-008: el name debe coincidir con la etiqueta IPTC del iptc_code enviado."""
    from app.stores.memory import categories_store

    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    target = iptc_list[0]
    # Limpiamos el store para evitar el conflicto 409 con la seed autouse.
    categories_store.pop(target["code"], None)

    payload = {
        "name": target["label"],
        "source": "IPTC",
        "iptc_code": target["code"],
        "iptc_label": target["label"],
    }
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["id"] == target["code"]
    assert response.json()["name"] == target["label"]


@pytest.mark.unit
def test_create_category_with_invalid_iptc_code(api_client, auth_headers):
    payload = {
        "name": "Inválida",
        "source": "IPTC",
        "iptc_code": "CODIGO_INEXISTENTE_XYZ",
    }
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_create_category_without_iptc_code(api_client, auth_headers):
    payload = {"name": "Sin IPTC", "source": "IPTC"}
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_get_category_by_id(api_client, auth_headers):
    """El listado devuelve `id` como string padded (SMOKE-005); el GET-single
    sigue normalizando a entero. El test convierte para comparar correctamente.
    """
    cat_id_raw = api_client.get("/api/v1/categories", headers=auth_headers).json()[0]["id"]
    cat_id_int = int(cat_id_raw)
    response = api_client.get(f"/api/v1/categories/{cat_id_int}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == cat_id_int


@pytest.mark.unit
def test_get_category_not_found(api_client, auth_headers):
    response = api_client.get("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.unit
def test_update_category_name(api_client, auth_headers):
    """GC-008/GC-012: si se actualiza el name, hay que enviar también un source
    coherente. Pasamos el iptc_label como name para que el catálogo lo acepte.
    """
    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    target = iptc_list[0]
    valid_name = target["label"]
    cat_id_int = int(target["code"])
    response = api_client.put(
        f"/api/v1/categories/{cat_id_int}",
        json={"name": valid_name, "source": "IPTC"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == valid_name


@pytest.mark.unit
def test_update_category_valid_iptc_code(api_client, auth_headers):
    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    valid_code = iptc_list[1]["code"]
    categories = api_client.get("/api/v1/categories", headers=auth_headers).json()
    cat_id_int = int(categories[0]["id"])
    response = api_client.put(
        f"/api/v1/categories/{cat_id_int}",
        json={"iptc_code": valid_code},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["id"] == cat_id_int


@pytest.mark.unit
def test_update_category_invalid_iptc_code(api_client, auth_headers):
    categories = api_client.get("/api/v1/categories", headers=auth_headers).json()
    iptc_codes = {item["code"] for item in api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()}
    cat_id = next((item["id"] for item in categories if item["id"] not in iptc_codes), categories[0]["id"])
    response = api_client.put(f"/api/v1/categories/{cat_id}", json={"iptc_code": "MAL_CODIGO"}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_update_category_not_found(api_client, auth_headers):
    """Para un id inexistente, evitamos el bloque de validación name/source
    (que devolvería 400) enviando solo iptc_code: debe responder 404.
    """
    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    response = api_client.put(
        "/api/v1/categories/99999",
        json={"iptc_code": iptc_list[0]["code"]},
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.unit
def test_delete_category_ok(api_client, auth_headers):
    categories = api_client.get("/api/v1/categories", headers=auth_headers).json()
    iptc_codes = {item["code"] for item in api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()}
    cat_id = next((item["id"] for item in categories if item["id"] not in iptc_codes), categories[0]["id"])
    response = api_client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 204


@pytest.mark.unit
def test_delete_category_not_found(api_client, auth_headers):
    response = api_client.delete("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404

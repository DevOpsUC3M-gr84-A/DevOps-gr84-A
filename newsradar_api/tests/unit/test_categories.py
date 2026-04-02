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
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Política"
    assert data["source"] == "IPTC"
    assert "id" in data


@pytest.mark.unit
def test_create_category_with_valid_iptc_code(api_client, auth_headers):
    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    valid_code = iptc_list[0]["code"]
    valid_label = iptc_list[0]["label"]

    payload = {
        "name": "Deportes",
        "source": "IPTC",
        "iptc_code": valid_code,
        "iptc_label": valid_label,
    }
    response = api_client.post("/api/v1/categories", json=payload, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["iptc_code"] == valid_code
    assert response.json()["iptc_label"] == valid_label


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
    assert response.status_code == 201
    assert response.json()["iptc_code"] is None


@pytest.mark.unit
def test_get_category_by_id(api_client, auth_headers):
    created = api_client.post("/api/v1/categories", json={"name": "Tech"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = api_client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == cat_id


@pytest.mark.unit
def test_get_category_not_found(api_client, auth_headers):
    response = api_client.get("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.unit
def test_update_category_name(api_client, auth_headers):
    created = api_client.post("/api/v1/categories", json={"name": "Vieja"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = api_client.put(f"/api/v1/categories/{cat_id}", json={"name": "Nueva"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nueva"


@pytest.mark.unit
def test_update_category_valid_iptc_code(api_client, auth_headers):
    iptc_list = api_client.get("/api/v1/iptc-categories", headers=auth_headers).json()
    valid_code = iptc_list[1]["code"]
    created = api_client.post("/api/v1/categories", json={"name": "Para actualizar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = api_client.put(f"/api/v1/categories/{cat_id}", json={"iptc_code": valid_code}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["iptc_code"] == valid_code


@pytest.mark.unit
def test_update_category_invalid_iptc_code(api_client, auth_headers):
    created = api_client.post("/api/v1/categories", json={"name": "Para fallar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = api_client.put(f"/api/v1/categories/{cat_id}", json={"iptc_code": "MAL_CODIGO"}, headers=auth_headers)
    assert response.status_code == 422


@pytest.mark.unit
def test_update_category_not_found(api_client, auth_headers):
    response = api_client.put("/api/v1/categories/99999", json={"name": "No existe"}, headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.unit
def test_delete_category_ok(api_client, auth_headers):
    created = api_client.post("/api/v1/categories", json={"name": "Para borrar"}, headers=auth_headers)
    cat_id = created.json()["id"]
    response = api_client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 204
    get_response = api_client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert get_response.status_code == 404


@pytest.mark.unit
def test_delete_category_not_found(api_client, auth_headers):
    response = api_client.delete("/api/v1/categories/99999", headers=auth_headers)
    assert response.status_code == 404

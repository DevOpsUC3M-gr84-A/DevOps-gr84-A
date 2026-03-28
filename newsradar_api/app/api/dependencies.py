from fastapi import HTTPException, status, Depends
from typing import Callable

# Asumimos que más adelante tendrás una dependencia real que extrae al usuario actual
# a partir del token JWT en la cabecera de la petición.
# Esta es una función simulada ("mock") temporal hasta que implementes la autenticación completa.
from app.models.user import User, UserRole


def get_current_user() -> User:
    """
    Dependencia simulada.
    En el futuro, aquí decodificarás el JWT y buscarás al usuario en la BD.
    """
    # Para pruebas, puedes cambiar este rol temporalmente
    return User(
        email="test@newsradar.com",
        name="Test",
        surname="User",
        role=UserRole.LECTOR,  # ¡Pruébalo cambiando a LECTOR o GESTOR!
        is_verified=True,
    )


def get_current_gestor(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependencia que verifica si el usuario actual tiene el rol de GESTOR.
    Si no lo tiene, lanza una excepción HTTP 403 Forbidden.
    """
    if current_user.role != UserRole.GESTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes los permisos necesarios (requiere rol de Gestor) para realizar esta acción.",
        )
    return current_user

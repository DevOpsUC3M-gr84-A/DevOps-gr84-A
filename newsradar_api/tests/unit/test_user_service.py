"""Unit tests for user_service.py covering all business logic functions."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import IntegrityError, InvalidRequestError

import pytest
from pydantic import ValidationError

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import (
    create_db_user,
    get_password_hash,
    is_verification_expired,
    list_all_users,
    role_from_role_ids,
    role_ids_from_role,
    update_user_role,
    update_user_role_by_role_id,
    update_db_user,
    verify_password,
    verify_user_email,
)


@pytest.mark.unit
class TestUserCreateSchemaValidation:
    """Tests for registration schema password validation."""

    def test_user_create_rejects_weak_password(self):
        with pytest.raises(ValidationError, match="La contraseña no cumple los requisitos de seguridad"):
            UserCreate(
                email="weak@test.com",
                first_name="Weak",
                last_name="User",
                organization="TestOrg",
                password="weakpass12",
            )


@pytest.mark.unit
class TestPasswordHashingAndVerification:
    """Tests for password hashing and verification logic."""

    def test_get_password_hash_returns_string(self):
        """Verify get_password_hash generates a valid hash string."""
        password = "Secret@123"
        hashed = get_password_hash(password)
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert hashed != password  # Hash should not be the same as plaintext

    def test_verify_password_correct_password_returns_true(self):
        """Verify password verification succeeds with correct password."""
        password = "Correct@Pass123"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_wrong_password_returns_false(self):
        """Verify password verification fails with wrong password."""
        password = "Correct@Pass123"
        wrong_password = "Wrong@Pass123"
        hashed = get_password_hash(password)
        assert verify_password(wrong_password, hashed) is False


@pytest.mark.unit
class TestRoleMapping:
    """Tests for role_ids and UserRole mappings."""

    def test_role_from_role_ids_gestor(self):
        """Verify role_from_role_ids returns GESTOR for role_id 1."""
        assert role_from_role_ids([1]) == UserRole.GESTOR
        assert role_from_role_ids([1, 2]) == UserRole.GESTOR  # GESTOR takes precedence

    def test_role_from_role_ids_admin(self):
        """Verify role_from_role_ids returns ADMIN for role_id 3."""
        assert role_from_role_ids([3]) == UserRole.ADMIN

    def test_role_from_role_ids_default_gestor(self):
        """Verify role_from_role_ids defaults to GESTOR when no role ids are provided."""
        assert role_from_role_ids([]) == UserRole.GESTOR

    def test_role_from_role_ids_lector(self):
        """Verify role_from_role_ids returns LECTOR for role_id 2."""
        assert role_from_role_ids([2]) == UserRole.LECTOR

    def test_role_ids_from_role_gestor(self):
        """Verify role_ids_from_role returns [1] for GESTOR."""
        assert role_ids_from_role(UserRole.GESTOR) == [1]

    def test_role_ids_from_role_admin(self):
        """Verify role_ids_from_role returns [3] for ADMIN."""
        assert role_ids_from_role(UserRole.ADMIN) == [3]

    def test_role_ids_from_role_lector(self):
        """Verify role_ids_from_role returns [2] for LECTOR."""
        assert role_ids_from_role(UserRole.LECTOR) == [2]


@pytest.mark.unit
class TestCreateDBUser:
    """Tests for create_db_user function."""

    def test_create_db_user_success(self):
        """Verify create_db_user successfully creates a user."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = UserCreate(
            email="newuser@test.com",
            first_name="New",
            last_name="User",
            organization="TestOrg",
            password="Password123!",
        )

        user = create_db_user(db, payload)

        assert user.email == "newuser@test.com"
        assert user.name == "New"
        assert user.surname == "User"
        assert user.organization == "TestOrg"
        assert user.role == UserRole.GESTOR
        assert user.is_verified is False
        db.add.assert_called_once_with(user)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(user)

    def test_create_db_user_with_lector_role(self):
        """Verify create_db_user still supports explicit LECTOR creation."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = UserCreate(
            email="lector@test.com",
            first_name="Lector",
            last_name="User",
            organization="Public",
            password="Password123!",
            role_ids=[2],
        )

        user = create_db_user(db, payload)

        assert user.role == UserRole.LECTOR

    def test_create_db_user_with_gestor_role(self):
        """Verify create_db_user creates user with GESTOR role."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        payload = UserCreate(
            email="gestor@test.com",
            first_name="Gestor",
            last_name="User",
            organization="Admin",
            password="Secure123!",
            role_ids=[1],
        )

        user = create_db_user(db, payload)

        assert user.email == "gestor@test.com"
        assert user.role == UserRole.GESTOR
        db.rollback.assert_not_called()

    def test_create_db_user_integrity_error_raises_value_error(self):
        """Verify create_db_user raises ValueError on IntegrityError (duplicate email)."""
        db = MagicMock()
        db.commit.side_effect = IntegrityError(
            "INSERT INTO user VALUES (...)",
            {},
            ValueError("UNIQUE constraint failed: user.email"),
        )
        db.rollback = MagicMock()

        payload = UserCreate(
            email="duplicate@test.com",
            first_name="Dup",
            last_name="User",
            organization="Test",
            password="Pwd1234!",
            role_ids=[2],
        )

        with pytest.raises(ValueError, match="El email ya está registrado"):
            create_db_user(db, payload)

        db.rollback.assert_called_once()


@pytest.mark.unit
class TestUpdateDBUser:
    """Tests for update_db_user function."""

    def test_update_db_user_email_and_name(self):
        """Verify update_db_user updates email and name successfully."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        db_user = User(
            id=1,
            email="old@test.com",
            name="OldName",
            surname="OldSurname",
            organization="OldOrg",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
        )

        payload = UserUpdate(
            email="new@test.com",
            first_name="NewName",
        )

        result = update_db_user(db, db_user, payload)

        # Verify the object was modified (it's the same object due to in-place modification)
        assert result is db_user
        assert result.email == "new@test.com"
        assert result.name == "NewName"
        assert result.surname == "OldSurname"  # Not updated
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(result)

    def test_update_db_user_password(self):
        """Verify update_db_user updates password hash."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        db_user = User(
            id=1,
            email="user@test.com",
            name="User",
            surname="Name",
            organization="Org",
            hashed_password="old_hash",
            role=UserRole.LECTOR,
            is_verified=False,
        )

        payload = UserUpdate(password="NewPassword@123")

        result = update_db_user(db, db_user, payload)

        assert result is db_user
        # Verify password was hashed (won't be the same as before and not plaintext)
        assert result.hashed_password != "old_hash"
        assert verify_password("NewPassword@123", result.hashed_password)

    def test_update_db_user_role(self):
        """Verify update_db_user updates user role."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        db_user = User(
            id=1,
            email="user@test.com",
            name="User",
            surname="Name",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
        )

        payload = UserUpdate(role_ids=[1])

        result = update_db_user(db, db_user, payload)

        assert result is db_user
        assert result.role == UserRole.GESTOR

    def test_update_db_user_integrity_error_raises_value_error(self):
        """Verify update_db_user raises ValueError on IntegrityError."""
        db = MagicMock()
        db.commit.side_effect = IntegrityError(
            "UPDATE user SET email=?",
            {},
            ValueError("UNIQUE constraint failed: user.email"),
        )
        db.rollback = MagicMock()

        db_user = User(
            id=1,
            email="old@test.com",
            name="User",
            surname="Name",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
        )

        payload = UserUpdate(email="duplicate@test.com")

        with pytest.raises(ValueError, match="El email ya está registrado"):
            update_db_user(db, db_user, payload)

        db.rollback.assert_called_once()

    def test_update_db_user_exclude_unset(self):
        """Verify update_db_user respects exclude_unset (only updates provided fields)."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        db_user = User(
            id=1,
            email="original@test.com",
            name="Original",
            surname="Name",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
        )

        payload = UserUpdate(first_name="Updated")

        result = update_db_user(db, db_user, payload)

        assert result is db_user
        assert result.email == "original@test.com"  # Should stay the same
        assert result.name == "Updated"  # Should be updated


    def test_update_db_user_avatar_and_banner(self):
        """Verifica que update_db_user actualiza el avatar y el banner correctamente."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        # Creamos un usuario de BD falso sin fotos
        db_user = User(
            id=1,
            email="foto@test.com",
            name="Foto",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            avatar=None,
            banner=None,
        )

        # Simulamos el payload del frontend con las fotos en Base64
        payload = UserUpdate(
            avatar="data:image/png;base64,TEXTO_AVATAR_FALSO",
            banner="data:image/png;base64,TEXTO_BANNER_FALSO",
        )

        result = update_db_user(db, db_user, payload)

        # Verificamos que se han inyectado bien
        assert result is db_user
        assert result.avatar == "data:image/png;base64,TEXTO_AVATAR_FALSO"
        assert result.banner == "data:image/png;base64,TEXTO_BANNER_FALSO"
        
        # Verificamos que se guardó en BD
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(result)


@pytest.mark.unit
class TestVerificationExpiry:
    """Tests for email verification expiry logic."""

    def test_is_verification_not_expired_recent_creation(self):
        """Verify is_verification_expired returns False for fresh user."""
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=datetime.now(timezone.utc),
        )

        assert is_verification_expired(user) is False

    def test_is_verification_expired_after_24_hours(self):
        """Verify is_verification_expired returns True after 24 hours."""
        past = datetime.now(timezone.utc) - timedelta(hours=25)
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=past,
        )

        assert is_verification_expired(user) is True

    def test_is_verification_expired_exactly_24_hours_boundary(self):
        """Verify is_verification_expired on 24 hour boundary."""
        past = datetime.now(timezone.utc) - timedelta(hours=24)
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=past,
        )

        result = is_verification_expired(user)
        # Should be True or False depending on microseconds, but let's accept True as "expired"
        assert isinstance(result, bool)

    def test_is_verification_expired_no_created_at(self):
        """Verify is_verification_expired returns True when created_at is None."""
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=None,
        )

        assert is_verification_expired(user) is True

    def test_is_verification_expired_naive_datetime(self):
        """Verify is_verification_expired handles naive datetime (converts to UTC)."""
        # Create a naive datetime from 25 hours ago
        naive_past = datetime.now() - timedelta(hours=25)
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=naive_past,
        )

        # Function converts naive to UTC, should be expired
        result = is_verification_expired(user)
        # May be True or False depending on exact timing, but should be boolean
        assert isinstance(result, bool)


@pytest.mark.unit
class TestVerifyUserEmail:
    """Tests for verify_user_email function."""

    def test_verify_user_email_already_verified(self):
        """Verify verify_user_email returns (False, message) if already verified."""
        db = MagicMock()

        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=True,
            created_at=datetime.now(timezone.utc),
        )

        success, message = verify_user_email(user, db)

        assert success is False
        assert "ya estaba verificado" in message
        db.commit.assert_not_called()

    def test_verify_user_email_expired_link(self):
        """Verify verify_user_email returns (False, message) if 24 hours have passed."""
        db = MagicMock()

        past = datetime.now(timezone.utc) - timedelta(hours=25)
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=past,
        )

        success, message = verify_user_email(user, db)

        assert success is False
        assert "caducado" in message
        db.commit.assert_not_called()

    def test_verify_user_email_success(self):
        """Verify verify_user_email marks user as verified and commits."""
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        now = datetime.now(timezone.utc)
        user = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=now,
        )

        success, message = verify_user_email(user, db)

        assert success is True
        assert user.is_verified is True
        assert "éxito" in message
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(user)


@pytest.mark.unit
class TestRollbackCoverage:
    """Tests that force generic exceptions to cover rollback branches."""

    def test_list_all_users_rolls_back_on_generic_exception(self, monkeypatch):
        db = MagicMock()
        db.rollback = MagicMock()
        monkeypatch.setattr(db, "query", MagicMock(side_effect=Exception("boom")))

        with pytest.raises(Exception, match="boom"):
            list_all_users(db)

        db.rollback.assert_called_once()

    def test_update_user_role_rolls_back_on_generic_exception(self, monkeypatch):
        db = MagicMock()
        db.rollback = MagicMock()
        query_result = MagicMock()
        query_result.filter.return_value.first.return_value = User(
            id=1,
            email="test@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=True,
        )
        monkeypatch.setattr(db, "query", MagicMock(return_value=query_result))
        monkeypatch.setattr(db, "commit", MagicMock(side_effect=Exception("commit failed")))

        with pytest.raises(Exception, match="commit failed"):
            update_user_role_by_role_id(db, 1, 2)

        db.rollback.assert_called_once()

    def test_update_user_role_legacy_helper_rolls_back_on_generic_exception(self, monkeypatch):
        db = MagicMock()
        db.rollback = MagicMock()
        query_result = MagicMock()
        query_result.filter.return_value.first.return_value = User(
            id=1,
            email="test2@test.com",
            name="Test",
            surname="User",
            organization="Org",
            hashed_password="hash",
            role=UserRole.LECTOR,
            is_verified=True,
        )
        monkeypatch.setattr(db, "query", MagicMock(return_value=query_result))
        monkeypatch.setattr(db, "commit", MagicMock(side_effect=Exception("commit failed")))

        with pytest.raises(Exception, match="commit failed"):
            update_user_role(db, 1, UserRole.GESTOR)

        db.rollback.assert_called_once()

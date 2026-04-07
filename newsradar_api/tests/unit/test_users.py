"""Integration tests for /users endpoints - simplified smoke tests."""

import pytest
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import create_db_user, get_password_hash, update_db_user, verify_user_email
from datetime import datetime, timezone


@pytest.mark.unit
class TestUsersEndpointIntegration:
    """Integration tests for users endpoint (via service layer)."""

    def test_create_user_integration(self, db_session: Session):
        """Verify user creation via service."""
        payload = UserCreate(
            email="newuser@integration.com",
            first_name="Integration",
            last_name="Test",
            organization="TestOrg",
            password="test123",
            role_ids=[2],
        )

        user = create_db_user(db_session, payload)

        assert user.email == "newuser@integration.com"
        assert user.name == "Integration"
        assert user.role == UserRole.LECTOR

    def test_get_user_integration(self, db_session: Session, seeded_user):
        """Verify user retrieval via DB."""
        retrieved = db_session.query(User).filter(User.id == seeded_user.id).first()

        assert retrieved is not None
        assert retrieved.email == seeded_user.email
        assert retrieved.name == seeded_user.name

    def test_update_user_integration(self, db_session: Session):
        """Verify user update via service."""
        # Create user in this session
        test_user = User(
            email="updatetest@test.com",
            name="UpdateTest",
            surname="User",
            organization="OldOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.LECTOR,
            is_verified=True,
        )
        db_session.add(test_user)
        db_session.commit()

        payload = UserUpdate(first_name="Updated", organization="NewOrg")

        updated = update_db_user(db_session, test_user, payload)

        assert updated.name == "Updated"
        assert updated.organization == "NewOrg"

    def test_delete_user_integration(self, db_session: Session):
        """Verify user deletion."""
        test_user = User(
            email="delete@test.com",
            name="ToDelete",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.LECTOR,
            is_verified=True,
        )
        db_session.add(test_user)
        db_session.commit()
        user_id = test_user.id

        db_session.delete(test_user)
        db_session.commit()

        deleted = db_session.query(User).filter(User.id == user_id).first()
        assert deleted is None

    def test_verify_user_email_integration(self, db_session: Session):
        """Verify email verification workflow."""
        test_user = User(
            email="verify@test.com",
            name="VerifyTest",
            surname="User",
            organization="TestOrg",
            hashed_password=get_password_hash("password123"),
            role=UserRole.LECTOR,
            is_verified=False,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(test_user)
        db_session.commit()

        success, message = verify_user_email(test_user, db_session)

        assert success is True
        assert test_user.is_verified is True

    def test_list_users_integration(self, db_session: Session, seeded_user, seeded_lector_user):
        """Verify user listing."""
        users = db_session.query(User).all()

        assert len(users) >= 2
        assert any(u.email == seeded_user.email for u in users)
        assert any(u.email == seeded_lector_user.email for u in users)

from typing import Optional

from pydantic import BaseModel, Field, computed_field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    # Sin default: si el cliente omite `source`, Pydantic emite 422 (GC-003).
    source: str = Field(..., pattern="^IPTC$")


class CategoryCreate(CategoryBase):
    id: Optional[int] = None
    iptc_code: Optional[int] = None
    iptc_label: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    source: Optional[str] = Field(None, pattern="^IPTC$")
    iptc_code: Optional[int] = None
    iptc_label: Optional[str] = None


class Category(CategoryBase):
    id: int

    @computed_field  # type: ignore[misc]
    @property
    def code(self) -> str:
        """Código IPTC de 8 dígitos (zero-padded), requerido por SMOKE-005."""
        return f"{self.id:08d}"
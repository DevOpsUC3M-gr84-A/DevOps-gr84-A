from pydantic import BaseModel, Field
from typing import Optional


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    source: str = Field(default="IPTC", pattern="^IPTC$")
    iptc_code: Optional[str] = None
    iptc_label: Optional[str] = None 


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    source: Optional[str] = Field(None, pattern="^IPTC$")
    iptc_code: Optional[str] = None
    iptc_label: Optional[str] = None 


class Category(CategoryBase):
    id: int

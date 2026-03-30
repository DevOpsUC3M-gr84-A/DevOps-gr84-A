from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class InformationSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    url: HttpUrl


class InformationSourceCreate(InformationSourceBase):
    pass


class InformationSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    url: Optional[HttpUrl] = None


class InformationSource(InformationSourceBase):
    id: int

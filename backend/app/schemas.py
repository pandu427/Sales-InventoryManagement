from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)

class ProductIn(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=180)
    description: str = ""
    price: float = Field(gt=0)
    stock: int = Field(ge=0)

class ProductOut(ProductIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    email: str = ""
    phone: str = ""
    address: str = ""

class CustomerOut(CustomerIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class OrderLineIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)

class OrderIn(BaseModel):
    customer_id: int
    items: list[OrderLineIn] = Field(min_length=1)
    note: str = ""

class DecisionIn(BaseModel):
    note: str = ""

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    line_total: float
    model_config = ConfigDict(from_attributes=True)

class OrderOut(BaseModel):
    id: int
    customer_id: int
    created_by: int
    total: float
    status: str
    note: str
    decision_note: str
    created_at: str
    items: list[OrderItemOut]
    model_config = ConfigDict(from_attributes=True)

from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from .config import settings
from .database import Base, engine, get_db, SessionLocal
from .models import User, Product, Customer, SalesOrder, OrderItem
from .schemas import LoginIn, UserOut, ProductIn, ProductOut, CustomerIn, CustomerOut, OrderIn, OrderOut, DecisionIn
from .security import hash_password, verify_password, create_token, current_user, roles
from .emailer import send_email

def seed():
    db = SessionLocal()
    try:
        for name, email, password, role in [
            ("Administrator", "admin@example.com", "Admin123!", "admin"),
            ("Demo Manager", "manager@example.com", "Manager123!", "manager"),
            ("Demo Staff", "staff@example.com", "Staff123!", "staff"),
        ]:
            if not db.query(User).filter_by(email=email).first():
                db.add(User(name=name, email=email, hashed_password=hash_password(password), role=role))
        db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()
    yield

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"message": settings.app_name, "docs": "/docs"}

@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == data.email.lower()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_token(user), "token_type": "bearer", "user": UserOut.model_validate(user)}

@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user

@app.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.query(Product).order_by(Product.id.desc()).all()

@app.post("/api/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    if db.query(Product).filter_by(sku=data.sku).first():
        raise HTTPException(409, "SKU already exists")
    item = Product(**data.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductIn, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    item = db.get(Product, product_id)
    if not item: raise HTTPException(404, "Product not found")
    duplicate = db.query(Product).filter(Product.sku == data.sku, Product.id != product_id).first()
    if duplicate: raise HTTPException(409, "SKU already exists")
    for key, value in data.model_dump().items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    item = db.get(Product, product_id)
    if not item: raise HTTPException(404, "Product not found")
    if db.query(OrderItem).filter_by(product_id=product_id).first():
        raise HTTPException(409, "Product is used by an order; edit it instead")
    db.delete(item); db.commit(); return {"message": "Product deleted"}

@app.get("/api/customers", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.query(Customer).order_by(Customer.id.desc()).all()

@app.post("/api/customers", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = Customer(**data.model_dump()); db.add(item); db.commit(); db.refresh(item); return item

@app.put("/api/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(Customer, customer_id)
    if not item: raise HTTPException(404, "Customer not found")
    for key, value in data.model_dump().items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    item = db.get(Customer, customer_id)
    if not item: raise HTTPException(404, "Customer not found")
    if db.query(SalesOrder).filter_by(customer_id=customer_id).first():
        raise HTTPException(409, "Customer has orders and cannot be deleted")
    db.delete(item); db.commit(); return {"message": "Customer deleted"}

def order_response(order):
    return {
        "id": order.id, "customer_id": order.customer_id, "created_by": order.created_by,
        "total": order.total, "status": order.status, "note": order.note,
        "decision_note": order.decision_note, "created_at": order.created_at.isoformat(),
        "items": [{"id": i.id, "product_id": i.product_id, "quantity": i.quantity,
                   "unit_price": i.unit_price, "line_total": i.line_total} for i in order.items]
    }

@app.get("/api/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), user: User = Depends(current_user)):
    orders = db.query(SalesOrder).options(joinedload(SalesOrder.items)).order_by(SalesOrder.id.desc()).all()
    return [order_response(o) for o in orders]

@app.post("/api/orders", response_model=OrderOut, status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not db.get(Customer, data.customer_id): raise HTTPException(404, "Customer not found")
    # Merge duplicate product lines so stock validation and totals remain accurate.
    quantities = {}
    for line in data.items: quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity
    try:
        total = 0.0
        lines = []
        for product_id, quantity in quantities.items():
            product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
            if not product: raise HTTPException(404, f"Product {product_id} not found")
            if product.stock < quantity: raise HTTPException(409, f"Insufficient stock for {product.name}; available: {product.stock}")
            lines.append((product, quantity, round(product.price * quantity, 2)))
            total += product.price * quantity
        total = round(total, 2)
        status_value = "pending_approval" if total > settings.approval_threshold else "confirmed"
        order = SalesOrder(customer_id=data.customer_id, created_by=user.id, total=total,
                           status=status_value, note=data.note)
        db.add(order); db.flush()
        for product, quantity, line_total in lines:
            db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=quantity,
                             unit_price=product.price, line_total=line_total))
        if status_value == "confirmed":
            for product, quantity, _ in lines: product.stock -= quantity
        db.commit()
        db.refresh(order)
    except Exception:
        db.rollback()
        raise
    if status_value == "pending_approval":
        send_email(settings.manager_email, f"Approval required: Order #{order.id}",
                   f"Order #{order.id} for {total:.2f} requires approval. Review it in the Sales & Inventory dashboard.")
    else:
        send_email(user.email, f"Order #{order.id} confirmed", f"Your order #{order.id} is confirmed. Total: {total:.2f}.")
    return order_response(order)

@app.post("/api/orders/{order_id}/approve", response_model=OrderOut)
def approve_order(order_id: int, data: DecisionIn, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    order = db.query(SalesOrder).options(joinedload(SalesOrder.items)).filter_by(id=order_id).with_for_update().first()
    if not order: raise HTTPException(404, "Order not found")
    if order.status != "pending_approval": raise HTTPException(409, f"Order is {order.status} and cannot be approved")
    try:
        for line in order.items:
            product = db.query(Product).filter(Product.id == line.product_id).with_for_update().first()
            if not product or product.stock < line.quantity:
                raise HTTPException(409, f"Insufficient stock for product ID {line.product_id}; order cannot be approved")
        for line in order.items:
            product = db.get(Product, line.product_id)
            product.stock -= line.quantity
        order.status = "confirmed"; order.decision_note = data.note; order.decided_at = datetime.utcnow()
        db.commit(); db.refresh(order)
    except Exception:
        db.rollback(); raise
    recipient = order.creator.email if order.creator else ""
    send_email(recipient, f"Order #{order.id} approved", f"Your order #{order.id} was approved. {data.note}")
    return order_response(order)

@app.post("/api/orders/{order_id}/reject", response_model=OrderOut)
def reject_order(order_id: int, data: DecisionIn, db: Session = Depends(get_db), user: User = Depends(roles("admin", "manager"))):
    order = db.query(SalesOrder).options(joinedload(SalesOrder.items)).filter_by(id=order_id).with_for_update().first()
    if not order: raise HTTPException(404, "Order not found")
    if order.status != "pending_approval": raise HTTPException(409, f"Order is {order.status} and cannot be rejected")
    order.status = "rejected"; order.decision_note = data.note; order.decided_at = datetime.utcnow()
    db.commit(); db.refresh(order)
    send_email(order.creator.email if order.creator else "", f"Order #{order.id} rejected",
               f"Your order #{order.id} was rejected. Reason: {data.note or 'No reason provided'}")
    return order_response(order)

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {
        "products": db.query(Product).count(),
        "customers": db.query(Customer).count(),
        "orders": db.query(SalesOrder).count(),
        "pending_approvals": db.query(SalesOrder).filter_by(status="pending_approval").count(),
        "confirmed_sales": round(db.query(func.coalesce(func.sum(SalesOrder.total), 0)).filter_by(status="confirmed").scalar() or 0, 2),
        "low_stock": db.query(Product).filter(Product.stock <= 5).count(),
        "inventory_units": db.query(func.coalesce(func.sum(Product.stock), 0)).scalar() or 0,
        "recent_orders": [order_response(o) for o in db.query(SalesOrder).options(joinedload(SalesOrder.items)).order_by(SalesOrder.id.desc()).limit(5).all()]
    }

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Sales & Inventory Management"
    secret_key: str = "replace-this-secret"
    database_url: str = "sqlite:///./sales_inventory.db"
    access_token_expire_minutes: int = 480
    approval_threshold: float = 1000
    frontend_origin: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    manager_email: str = "manager@example.com"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

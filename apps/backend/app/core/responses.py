from typing import Any, Optional
from pydantic import BaseModel

class StandardResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None

class ErrorDetail(BaseModel):
    code: str
    message: str

class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail

def success_response(data: Any = None, message: str = None):
    return {"success": True, "data": data, "message": message}

def error_response(code: str, message: str, status_code: int = 400):
    from fastapi import HTTPException
    raise HTTPException(
        status_code=status_code,
        detail={"success": False, "error": {"code": code, "message": message}}
    )

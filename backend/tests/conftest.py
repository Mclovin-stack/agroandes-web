import os
import tempfile
from pathlib import Path

import pytest

# Base de datos temporal para no tocar la real; debe definirse antes de importar la app
_tmp = Path(tempfile.mkdtemp()) / "pruebas.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def cliente():
    with TestClient(app) as c:   # el "with" ejecuta el arranque, que carga los 5.000 lotes
        yield c

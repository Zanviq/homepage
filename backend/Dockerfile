# Raspberry Pi (arm64) compatible
FROM python:3.11-slim

WORKDIR /app

# System deps kept minimal; slim image already has what we need.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

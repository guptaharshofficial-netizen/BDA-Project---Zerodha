# YourBroker AI Portfolio prototype - one container: Python API + pre-built React UI.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY prototype/requirements.txt prototype/requirements.txt
RUN pip install --no-cache-dir -r prototype/requirements.txt
COPY . .
# Build the data artifacts and the clustering model once, at image build time.
RUN cd prototype/backend && python -m yourbroker.build
WORKDIR /app/prototype/backend
EXPOSE 8000
# Hosts like Render pass the port in $PORT.
CMD ["sh", "-c", "uvicorn yourbroker.api:app --host 0.0.0.0 --port ${PORT:-8000}"]

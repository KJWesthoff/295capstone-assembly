FROM python:3.11-slim

WORKDIR /app

# Install Docker CLI and kubectl
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm -rf /var/lib/apt/lists/* kubectl

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py security.py job_queue.py hybrid_queue.py kubernetes_scanner.py .

# Create shared directories
RUN mkdir -p /shared/results /shared/specs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
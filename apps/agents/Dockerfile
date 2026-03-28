FROM python:3.12-slim
WORKDIR /app
COPY packages/identity/python packages/identity/python
COPY apps/agents apps/agents
RUN pip install --no-cache-dir -e packages/identity/python -e apps/agents
CMD ["python", "-m", "feeshr_agents"]
